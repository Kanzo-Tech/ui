import { Selection, clauseInterval, clausePoint, clauseSemiJoin } from "@kanzo-tech/mosaic";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { highlighted } from "../render/motion";
import { matchingIds, parseQuery } from "./source";
import { createGraph } from "./store";

/**
 * **The invariants of `/docs/design/crossfilter#invariants`, as properties.** Each run publishes a
 * random set of clauses, from random sources, in a random order, and checks what the store says is
 * kept against an oracle that is not the store: DuckDB, asked directly over the corpus's tables. The
 * clauses are identity clauses (`dense_id IN …`), which every type answers, so the properties here
 * hold whatever a type that cannot answer a clause does; that rule has its own tests.
 *
 * The corpus (`test/corpus.ts`): `Person` 0–9 at `lon = i, lat = 0`, `Place` 10–15 at `lat = 1`, and
 * `Tag` 16–19 with no `lon` or `lat`, so under `x: "lon", y: "lat"` the four tags have no position.
 */

const SIZE = 20;
const SOURCES = ["a", "b", "c"] as const;
type Source = (typeof SOURCES)[number];

/** A clause per source, or none: what the page holds at the end of a run. */
const page = fc.record(Object.fromEntries(SOURCES.map((s) => [s, fc.option(fc.uniqueArray(fc.integer({ min: 0, max: SIZE - 1 }), { maxLength: SIZE }), { nil: null })])) as Record<Source, fc.Arbitrary<number[] | null>>);
/** The canvas's own clause, or none. */
const pick = fc.option(fc.uniqueArray(fc.integer({ min: 0, max: SIZE - 1 }), { minLength: 1, maxLength: SIZE }), { nil: null });

/** The ids DuckDB keeps under every clause, read from the vertex tables themselves; `placed` adds that both coordinates are numbers. */
async function oracle(corpus: Attached, sets: readonly (readonly number[])[], placed: boolean): Promise<number[]> {
  const where = [
    ...sets.map((ids) => (ids.length === 0 ? "FALSE" : `dense_id IN (${ids.join(", ")})`)),
    ...(placed ? ["lon IS NOT NULL", "lat IS NOT NULL"] : []),
  ];
  const union = [
    `SELECT dense_id, lon, lat FROM ${corpus.from}."Person"`,
    `SELECT dense_id, lon, lat FROM ${corpus.from}."Place"`,
    `SELECT dense_id, NULL AS lon, NULL AS lat FROM ${corpus.from}."Tag"`,
  ].join(" UNION ALL ");
  const sql = `SELECT dense_id FROM (${union}) ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY dense_id`;
  const table = (await corpus.coordinator.query(sql)) as { getChild(name: string): { toArray(): ArrayLike<number> } | null };
  return Array.from(table.getChild("dense_id")?.toArray() ?? [], Number);
}

const ids = (mask: Uint8Array | null | undefined) => [...(mask ?? [])].flatMap((on, id) => (on ? [id] : []));

async function mapped() {
  const corpus = await attach();
  const crossfilter = Selection.crossfilter();
  const store = createGraph({ from: corpus.from, coordinator: corpus.coordinator, onFailure: vi.fn(), filterBy: crossfilter, x: "lon", y: "lat" });
  // A subscriber connects the graph's client, as a mounted canvas does.
  store.subscribe(() => {});
  await settle(corpus);
  const sources = Object.fromEntries(SOURCES.map((s) => [s, { reset() {} }])) as Record<Source, { reset(): void }>;
  const publish = (s: Source, set: readonly number[] | null) =>
    crossfilter.update(clauseSemiJoin("dense_id", set === null ? null : [...set], { source: sources[s], label: s }));
  return { corpus, crossfilter, store, publish };
}

/**
 * Every clause the page holds at the end, the canvas's included. `null` is no clause; an empty set is
 * a clause that keeps nothing, as `clauseSemiJoin` builds it (`/docs/design/crossfilter`, divergence 10).
 */
const held = (state: Record<Source, number[] | null>, canvas: number[] | null) =>
  [...SOURCES.map((s) => state[s]), canvas].filter((set): set is number[] => set !== null);

const RUNS = { numRuns: 25 };
/**
 * Twenty-five pages per property, each a round of real DuckDB queries: about four seconds a property
 * on a laptop, which vitest's default five-second budget for one test does not leave room for on a CI
 * runner. The work is the point of the test, so the budget is the property's, stated here.
 */
const BUDGET = { timeout: 60_000 };
/** A client that published nothing: the page's predicate as it reads it holds every clause. */
const bystander = { reset() {} };

describe("the page's crossfilter, as properties of kept", () => {
  it("keeps what every clause keeps, whatever the order they are published in (invariants 1, 3)", BUDGET, async () => {
    const { corpus, store, publish } = await mapped();
    await fc.assert(
      fc.asyncProperty(page, pick, fc.array(fc.constantFrom(...SOURCES), { maxLength: 6 }), fc.func(fc.boolean()), async (state, canvas, noise, flip) => {
        // Noise first — clauses from the same sources that the final state replaces — then the final
        // clauses in an order the run chooses: one clause per source means only the last one counts.
        for (const [i, s] of noise.entries()) publish(s, [i]);
        const order = [...SOURCES].sort((x, y) => (flip(x, y) ? 1 : -1));
        for (const s of order) publish(s, state[s]);
        store.select(canvas, "lasso", "Lasso");
        await settle(corpus);
        const expected = await oracle(corpus, held(state, canvas), false);
        const clauses = held(state, canvas).length;
        expect(clauses === 0 ? null : ids(store.getSnapshot().kept)).toEqual(clauses === 0 ? null : expected);
        for (const s of SOURCES) publish(s, null);
        store.select(null);
        await settle(corpus);
      }),
      RUNS,
    );
  });

  it("never narrows what is kept when a clause is withdrawn (invariant 2)", BUDGET, async () => {
    const { corpus, store, publish } = await mapped();
    await fc.assert(
      fc.asyncProperty(page, fc.subarray([...SOURCES]), async (state, withdrawn) => {
        for (const s of SOURCES) publish(s, state[s]);
        await settle(corpus);
        const before = store.getSnapshot().kept;
        for (const s of withdrawn) publish(s, null);
        await settle(corpus);
        const after = store.getSnapshot().kept;
        // kept_C ⊆ kept_C′ for C′ ⊆ C: every vertex kept before is kept after. `null` keeps everything.
        if (after !== null) for (const id of ids(before ?? new Uint8Array(SIZE).fill(1))) expect(after[id]).toBe(1);
        for (const s of SOURCES) publish(s, null);
        await settle(corpus);
      }),
      RUNS,
    );
  });

  it("is read once: the canvas's colour, the counts, the toolbar and the frame all read kept and placed (invariants 5, 6, 7)", BUDGET, async () => {
    const { corpus, store, publish } = await mapped();
    await fc.assert(
      fc.asyncProperty(page, pick, async (state, canvas) => {
        for (const s of SOURCES) publish(s, state[s]);
        store.select(canvas, "lasso", "Lasso");
        await settle(corpus);
        const snapshot = store.getSnapshot();
        const clauses = held(state, canvas);
        const keptPlaced = await oracle(corpus, clauses, true);
        if (clauses.length === 0) {
          expect([snapshot.kept, snapshot.matching, store.visible()]).toEqual([null, null, null]);
        } else {
          // The counts: match is kept *and* placed — a kept tag has no position, so it is no match.
          expect(snapshot.matching).toBe(keptPlaced.length);
          // The toolbar's count and what `frame()` fits.
          expect(store.visible()).toEqual(keptPlaced);
          // The canvas colours exactly kept: of what it draws, that is kept and placed.
          const coloured = highlighted(snapshot.geometry!, snapshot.kept).highlightedPointIndices ?? [];
          expect(coloured.filter((id) => Number.isFinite(snapshot.geometry!.positions[id * 2]))).toEqual(keptPlaced);
        }
        expect(snapshot.drawn?.placed.reduce((a, n) => a + n, 0)).toBe((await oracle(corpus, [], true)).length);
        for (const s of SOURCES) publish(s, null);
        store.select(null);
        await settle(corpus);
      }),
      RUNS,
    );
  });

  it("places the same vertices under every clause: no filter moves a vertex out of place (invariant 4)", BUDGET, async () => {
    const { corpus, store, publish } = await mapped();
    const placedAlone = (await oracle(corpus, [], true)).length;
    await fc.assert(
      fc.asyncProperty(page, pick, async (state, canvas) => {
        for (const s of SOURCES) publish(s, state[s]);
        store.select(canvas, "lasso", "Lasso");
        await settle(corpus);
        expect(store.getSnapshot().drawn?.placed.reduce((a, n) => a + n, 0)).toBe(placedAlone);
        for (const s of SOURCES) publish(s, null);
        store.select(null);
        await settle(corpus);
      }),
      RUNS,
    );
  });

  it("asks nothing for its own clause, and keeps no more than the page's other clauses keep (invariant 8)", BUDGET, async () => {
    const { corpus, crossfilter, store, publish } = await mapped();
    await fc.assert(
      fc.asyncProperty(page, pick, async (state, canvas) => {
        for (const s of SOURCES) publish(s, state[s]);
        await settle(corpus);
        const others = await oracle(corpus, held(state, null), false);
        const sent = corpus.sent.length;
        store.select(canvas, "lasso", "Lasso");
        await settle(corpus);
        // The canvas's clause is on the page …
        if (canvas) expect(String(crossfilter.predicate(bystander as never))).toContain(`IN (${canvas.join(", ")})`);
        // … the graph asks nothing new for it: it is exempt from its own clause, as Mosaic exempts every client …
        expect(corpus.sent.slice(sent).filter((sql) => sql.includes("WHERE"))).toEqual([]);
        // … and what it keeps is within what the other clauses keep: kept_C ⊆ kept_C^¬canvas.
        const kept = store.getSnapshot().kept;
        if (kept !== null && held(state, null).length > 0) for (const id of ids(kept)) expect(others).toContain(id);
        for (const s of SOURCES) publish(s, null);
        store.select(null);
        await settle(corpus);
      }),
      RUNS,
    );
  });
});

/**
 * **A clause a type cannot answer keeps none of that type** — the rule decided on
 * `/docs/design/crossfilter#formal-semantics`, `ans(c, v) = false` when `T(v)` lacks a column of `c`.
 * Column clauses join the identity ones here: `score` only Person has, `name` Person and Place have,
 * and Tag has neither. The oracle applies the rule table by table in SQL, a clause on a column a table
 * lacks being `FALSE` there, so it is read from the tables' own columns and not from the store.
 */
describe("a clause a type cannot answer", () => {
  const COLUMNS: Record<string, readonly string[]> = { Person: ["name", "score"], Place: ["name"], Tag: [] };
  type Column = { kind: "score"; range: [number, number] } | { kind: "name"; value: string };
  const column: fc.Arbitrary<Column> = fc.oneof(
    fc.tuple(fc.integer({ min: 0, max: 11 }), fc.integer({ min: 0, max: 11 })).map(([a, b]) => ({ kind: "score" as const, range: [Math.min(a, b), Math.max(a, b)] as [number, number] })),
    fc.constantFrom("Person 3", "Place 12", "Place 14", "nobody").map((value) => ({ kind: "name" as const, value })),
  );
  const sqlOf = (c: Column) => (c.kind === "score" ? `score BETWEEN ${c.range[0]} AND ${c.range[1]}` : `name = '${c.value}'`);

  async function oracle(corpus: Attached, columns: readonly Column[], sets: readonly (readonly number[])[]): Promise<number[]> {
    const branches = Object.entries(COLUMNS).map(([table, has]) => {
      const where = [
        ...columns.map((c) => (has.includes(c.kind) ? sqlOf(c) : "FALSE")),
        ...sets.map((ids) => (ids.length === 0 ? "FALSE" : `dense_id IN (${ids.join(", ")})`)),
      ];
      return `SELECT dense_id FROM ${corpus.from}."${table}"${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
    });
    const table = (await corpus.coordinator.query(`SELECT dense_id FROM (${branches.join(" UNION ALL ")}) ORDER BY dense_id`)) as { getChild(name: string): { toArray(): ArrayLike<number> } | null };
    return Array.from(table.getChild("dense_id")?.toArray() ?? [], Number);
  }

  it("is outside a search's subset by the same rule: the search finds inside exactly what is kept", BUDGET, async () => {
    const { corpus, store } = await mapped();
    const structure = store.getSnapshot().structure!;
    const source = { reset() {} };
    await fc.assert(
      fc.asyncProperty(fc.array(column, { maxLength: 2 }), fc.array(fc.uniqueArray(fc.integer({ min: 0, max: SIZE - 1 }), { maxLength: SIZE }), { maxLength: 2 }), async (columns, sets) => {
        // The subset as the search is handed it: the page's clauses, as predicates.
        const page = Selection.crossfilter();
        columns.forEach((c, i) => page.update(c.kind === "score" ? clauseInterval("score", c.range, { source: [source, { reset() {} }][i]! }) : clausePoint("name", c.value, { source: [source, { reset() {} }][i]! })));
        sets.forEach((set) => page.update(clauseSemiJoin("dense_id", set, { source: { reset() {} }, label: "set" })));
        const subset = page.clauses.map((clause) => clause.predicate).filter((p) => p !== null) as never[];
        const found = await matchingIds(corpus.coordinator, structure, parseQuery("", structure), { subset });
        const expected = subset.length === 0 ? Array.from({ length: SIZE }, (_, i) => i) : await oracle(corpus, columns, sets);
        expect([...found].sort((a, b) => a - b)).toEqual(expected);
      }),
      RUNS,
    );
  });

  it("keeps none of it, whatever else the page holds (ans(c, v) = false)", BUDGET, async () => {
    const { corpus, store, crossfilter, publish } = await mapped();
    const charts = [{ reset() {} }, { reset() {} }] as const;
    await fc.assert(
      fc.asyncProperty(fc.array(column, { maxLength: 2 }), page, async (columns, state) => {
        // A clean page first: a failed case leaves its clauses, and the shrinker replays from them.
        // A null interval withdraws a source's clause; `clausePoint(field, null)` would publish `IS NULL`.
        for (const source of charts) crossfilter.update(clauseInterval("score", null, { source }));
        for (const s of SOURCES) publish(s, null);
        columns.forEach((c, i) => {
          const source = charts[i as 0 | 1];
          crossfilter.update(c.kind === "score" ? clauseInterval("score", c.range, { source }) : clausePoint("name", c.value, { source }));
        });
        for (const s of SOURCES) publish(s, state[s]);
        await settle(corpus);
        const sets = held(state, null);
        const expected = columns.length + sets.length === 0 ? null : await oracle(corpus, columns, sets);
        expect(store.getSnapshot().kept === null ? null : ids(store.getSnapshot().kept)).toEqual(expected);
        for (const source of charts) crossfilter.update(clauseInterval("score", null, { source }));
        for (const s of SOURCES) publish(s, null);
        await settle(corpus);
      }),
      RUNS,
    );
  });
});
