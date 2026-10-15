import { describe, expect, it } from "vitest";
import { queryableConformance, type Queryable, type QueryableTable } from "./queryable";

/**
 * A scripted engine that knows the kit's statements and nothing else: just enough to hold the kit to
 * what it says it asserts. The kit is exercised against the real DuckDB-WASM in `@kanzo-tech/mosaic`'s
 * tests; these prove the kit can fail, which a kit that only ever passes cannot show.
 */
const table = (columns: Record<string, unknown[]>): QueryableTable => ({
  numRows: Object.values(columns)[0]!.length,
  schema: { fields: Object.keys(columns).map((name) => ({ name })) },
  getChild: (name) => {
    const values = columns[name];
    return values ? { length: values.length, get: (index) => values[index] } : null;
  },
});

const coded = (code: string, message = code) => Object.assign(new Error(message), { code });

interface Faults {
  /** Aborting does not interrupt: the long statement runs on and holds the connection. */
  deaf?: boolean;
  /** A statement is sent even when its signal was aborted before the call. */
  sendsAborted?: boolean;
  /** A refusal repeats the statement's literals. */
  leaks?: boolean;
  /** Never rejects with engine/lost. */
  silentDeath?: boolean;
}

function scripted(faults: Faults = {}) {
  const created = new Set<string>();
  let dead: Error | undefined;
  const dying: ((error: Error) => void)[] = [];
  let busyUntil = 0;
  const queryable: Queryable = {
    async query(sql, { signal }) {
      if (dead) throw dead;
      if (signal.aborted && !faults.sendsAborted) throw signal.reason;
      const wait = Math.max(0, busyUntil - Date.now());
      if (wait > 0) await new Promise((next) => setTimeout(next, wait));
      if (sql.startsWith("CREATE TEMP TABLE kit_was_sent")) {
        created.add("kit_was_sent");
        if (signal.aborted) throw signal.reason;
        return table({ one: [1] });
      }
      if (sql === "SELECT * FROM kit_was_sent") {
        if (created.has("kit_was_sent")) return table({ one: [1] });
        throw coded("engine/failed", "Table kit_was_sent does not exist");
      }
      if (sql.includes("nowhere_at_all")) {
        throw coded("engine/failed", faults.leaks ? sql : "Table with name nowhere_at_all does not exist");
      }
      if (sql.startsWith("SELECT sum")) {
        return new Promise<QueryableTable>((_resolve, reject) => {
          dying.push(reject);
          signal.addEventListener("abort", () => {
            if (faults.deaf) busyUntil = Date.now() + 1000;
            reject(signal.reason);
          });
        });
      }
      if (sql.includes("NULL")) return table({ nothing: [null] });
      if (sql.includes("AS answer")) return table({ answer: [42], letter: ["x"] });
      return table({ one: [1] });
    },
  };
  const kill = () => {
    dead = faults.silentDeath ? new Error("socket hang up") : coded("engine/lost", "the worker died");
    for (const reject of dying) reject(dead);
  };
  return { queryable, kill };
}

const run = async (faults?: Faults, options?: Parameters<typeof queryableConformance>[1]) => {
  const outcome: Record<string, string> = {};
  for (const { name, run: one } of queryableConformance(async () => scripted(faults), options)) {
    outcome[name] = await one().then(
      () => "ok",
      (error: Error) => error.message,
    );
  }
  return outcome;
};

const failing = (outcome: Record<string, string>) =>
  Object.entries(outcome)
    .filter(([, result]) => result !== "ok")
    .map(([name]) => name);

describe("queryableConformance", () => {
  it("passes an engine that does what it asks", async () => {
    expect(failing(await run())).toEqual([]);
  });

  it("fails an engine whose abort does not stop the statement", async () => {
    const outcome = await run({ deaf: true });
    expect(failing(outcome)).toEqual([expect.stringMatching(/^interrupts a long statement/)]);
    expect(Object.values(outcome).join()).toMatch(/the abort did not stop the statement/);
  });

  it("fails an engine that sends a statement whose signal was already aborted", async () => {
    expect(failing(await run({ sendsAborted: true }))).toEqual([expect.stringMatching(/^rejects a signal aborted before/)]);
  });

  it("fails an engine whose refusal carries the statement's literals", async () => {
    expect(failing(await run({ leaks: true }))).toEqual([expect.stringMatching(/^rejects a refused statement/)]);
  });

  it("fails an engine that dies without saying engine/lost", async () => {
    expect(failing(await run({ silentDeath: true }))).toEqual([expect.stringMatching(/^rejects a statement the engine died under/)]);
  });

  it("holds an engine that cannot cancel to refusing a signal, not ignoring it", async () => {
    const outcome = await run(undefined, { cancels: false, dies: false });
    expect(Object.keys(outcome).some((name) => name.startsWith("interrupts"))).toBe(false);
    expect(failing(outcome)).toEqual([expect.stringMatching(/^refuses a statement handed a signal/)]);
  });
});
