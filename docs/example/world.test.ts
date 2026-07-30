import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERS, member } from "./people";
import { QUESTS, overdueQuests, quest } from "./quests";
import { ROSTER, availableNow, rosterEntry, rosterOf } from "./roster";
import { BEASTS, HALLS, QUEST_STATUSES, REGIONS, TODAY } from "./world";

// What this guards is not "the data exists" — the docs build proves that by importing it. It is
// the two things a build cannot see: that the fixture still matches the prose written about it,
// and that it is the same fixture on the next run.

describe("the board is deterministic", () => {
  it("draws the same contracts every run", () => {
    // A digest rather than a full snapshot: the derived half is what has to be stable, and a
    // 44-row object dump would be re-approved without being read.
    const digest = QUESTS.map(
      (q) => `${q.id} ${q.status} ${q.reward} ${q.party.join("+") || "-"}`,
    ).join("\n");
    expect(digest).toMatchSnapshot();
  });

  it("reads no clock and no unseeded randomness", () => {
    // The rule that keeps the above true. `Date.now()`, an argument-less `new Date()` or a
    // `Math.random()` anywhere in the world would make the committed snapshot differ from a
    // rebuild — and would break a date-picker example that has to open on the same day twice.
    const dir = __dirname;
    const offenders: string[] = [];

    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
      if (file.endsWith(".test.ts")) continue;
      // Comments stripped first: the modules explain *why* they never call `Date.now()`, and a
      // scanner that cannot tell an explanation from a call would forbid documenting the rule.
      const source = readFileSync(join(dir, file), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const [pattern, what] of [
        [/Date\.now\(\)/, "Date.now()"],
        [/new Date\(\s*\)/, "new Date()"],
        [/Math\.random\(\)/, "Math.random()"],
      ] as const) {
        if (pattern.test(source)) offenders.push(`${file}: ${what}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("is frozen on a year no reader will mistake for their own data", () => {
    expect(TODAY.getUTCFullYear()).toBe(1312);
  });
});

describe("the board is internally consistent", () => {
  it("has unique, ascending ids", () => {
    const ids = QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it("names only members who exist", () => {
    for (const q of QUESTS) {
      for (const id of q.party) expect(() => member(id)).not.toThrow();
    }
  });

  it("leaves open contracts unclaimed and claimed ones staffed", () => {
    for (const q of QUESTS) {
      if (q.status === "open") expect(q.party).toEqual([]);
      else expect(q.party.length).toBeGreaterThan(0);
    }
  });

  it("pays for difficulty", () => {
    const rewardsBy = (grade: number) =>
      QUESTS.filter((q) => q.grade === grade).map((q) => q.reward);
    // Not just "correlated on average": the bands must not overlap, or a reward sort would look
    // broken to anyone checking it against the grade column.
    expect(Math.min(...rewardsBy(5))).toBeGreaterThan(Math.max(...rewardsBy(4)));
    expect(Math.min(...rewardsBy(2))).toBeGreaterThan(Math.max(...rewardsBy(1)));
  });
});

describe("every domain is populated", () => {
  it("fills all five statuses at least twice", () => {
    for (const status of QUEST_STATUSES) {
      const count = QUESTS.filter((q) => q.status === status.id).length;
      expect(count, `status ${status.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("fills all eight beasts, so an eight-slot scheme has eight non-empty categories", () => {
    for (const b of BEASTS) {
      expect(QUESTS.some((q) => q.beast === b.id), `beast ${b.id}`).toBe(true);
    }
  });

  it("fills every region and gives every hall something to post", () => {
    for (const region of REGIONS) {
      expect(QUESTS.some((q) => q.region === region), region).toBe(true);
    }
    for (const hall of HALLS) {
      expect(QUESTS.some((q) => q.hall === hall.id), hall.id).toBe(true);
    }
  });

  it("keeps a beast-free tail, so `beast` is a genuinely optional column", () => {
    expect(QUESTS.some((q) => q.beast === undefined)).toBe(true);
  });
});

describe("the roster is derived from the board, not authored beside it", () => {
  it("never shows Ready beside a member the board has committed", () => {
    const live = QUESTS.filter((q) => q.status === "claimed" || q.status === "afield");
    const committed = new Set<string>(live.flatMap((q) => q.party));
    for (const entry of ROSTER) {
      if (committed.has(entry.id)) expect(entry.availability, entry.id).not.toBe("ready");
    }
  });

  it("commits nobody to two live contracts at once", () => {
    const live = QUESTS.filter((q) => q.status === "claimed" || q.status === "afield");
    const seen = new Map<string, string>();
    for (const q of live) {
      for (const id of q.party) {
        expect(seen.has(id), `${id} is on ${seen.get(id)} and ${q.id}`).toBe(false);
        seen.set(id, q.id);
      }
    }
  });

  it("shows Afield only for members the board actually has out", () => {
    for (const entry of ROSTER) {
      if (entry.availability === "afield") expect(entry.contract, entry.id).toBeDefined();
    }
  });

  it("populates enough of the availability states to be worth filtering", () => {
    const states = new Set(ROSTER.map((entry) => entry.availability));
    expect(states.size).toBeGreaterThanOrEqual(4);
  });

  it("leaves somebody at home in every hall", () => {
    // Found on screen, not in a test: the Amber Hall posts the most contracts and parties draw
    // from home first, so its entire roster came back "Afield" — on the hall every showcase opens
    // on, with nothing left for a "claim this contract" control to offer.
    for (const entry of HALLS) {
      const ready = rosterOf(entry.id).filter((m) => m.availability === "ready");
      expect(ready.length, `${entry.id} has nobody ready`).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps at least a third of the guild claimable", () => {
    expect(availableNow().length / ROSTER.length).toBeGreaterThan(1 / 3);
  });
});

describe("the claims the docs make about the world", () => {
  it("has an overdue contract for the alert and toast examples to point at", () => {
    expect(overdueQuests().length).toBeGreaterThan(0);
  });

  it("really violates the party rule on the contract the rule page cites", () => {
    // `rules.ts` rejects a grade-5 contract whose party carries no cantor. If a later edit staffed
    // a cantor onto this one, the rule example would show a passing rule and prove nothing.
    const cited = QUESTS.find((q) => q.title === "A basilisk, and it knows the route");
    expect(cited).toBeDefined();
    expect(cited?.grade).toBe(5);
    expect(cited?.party.some((id) => member(id).role === "cantor")).toBe(false);
  });

  it("keeps the missing scout out afield, so the roster and the board agree", () => {
    expect(rosterEntry("fenn").availability).toBe("missing");
    // Settled contracts may name Fenn freely — those are history, and Fenn worked before going
    // missing. What must hold is the live half: exactly one, and still out.
    const live = QUESTS.filter(
      (q) => q.party.includes("fenn") && (q.status === "claimed" || q.status === "afield"),
    );
    expect(live.map((q) => q.status)).toEqual(["afield"]);
  });

  it("resolves a quest by id", () => {
    expect(quest("Q-1041").title).toBe("Something is eating the bell-ropes");
    expect(() => quest("Q-9999")).toThrow();
  });
});
