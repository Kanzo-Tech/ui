// The archive — every contract the halls have closed, and the only fixture in the world big enough
// to be a graph.
//
// The board is 44 contracts. The workspace showcase's graph is ~630 nodes, and it works because
// keywords and publishers are *shared hubs*: a keyword belongs to many datasets, so lassoing a
// cluster pulls in things you did not know were related. Forty-four contracts cannot do that.
//
// The archive can, and it earns its place rather than merely padding: every member's `settled`
// count on the roster is a number that had no cause. Here it becomes one. Parties are drawn
// against each member's settled quota until the quota is spent, so the archive *is* the history
// those numbers were counting — 1,358 slots across 35 members, and a test that fails if the two
// ever stop agreeing.
//
// Shared hubs, exactly as the old corpus had them:
//   a member  → many contracts   (Halla Grieve appears 118 times)
//   a beast   → many regions
//   a tag     → many contracts
//   a region  → many contracts
// Field reports hang off a contract as leaves, the way distributions hung off a dataset.

import { rng } from "@/lib/rng";
import { MEMBERS, type Member, type MemberId } from "./people";
import {
  type BeastId,
  BEASTS,
  type Grade,
  type HallId,
  HALLS,
  type Region,
  REGIONS,
  type Tag,
  TAGS,
} from "./world";

export interface ArchivedQuest {
  /** `A-0001`, oldest first. The board's live ids are `Q-`, so the two never collide. */
  id: string;
  title: string;
  hall: HallId;
  region: Region;
  beast?: BeastId;
  grade: Grade;
  /** Terminal by definition — the archive holds what is finished. */
  outcome: "settled" | "failed";
  reward: number;
  /** Days before `TODAY`, negative. Spread over about eight years. */
  closedDayOffset: number;
  party: MemberId[];
  tags: Tag[];
  /** Field reports filed against it — leaf nodes, as distributions were. */
  reports: number;
}

/** Places a contract happens. Not regions: the small named things inside them. */
const PLACES = [
  "the mill", "the tithe-barn", "the lower ford", "the chapel roof", "the drowned lane",
  "the causeway", "the granary", "the salt-house", "the quarry", "the north gate",
  "the upper terraces", "the forge-flues", "the orchard", "the bell-tower", "the weir",
  "the lantern-line", "the tanning yard", "the cattle road", "the burned wing", "the cistern",
  "the ferry steps", "the coppice", "the dye-works", "the lime kiln", "the fish traps",
  "the boundary stones", "the almshouse", "the old bridge", "the sheep folds", "the smokehouse",
];

const OPENINGS = [
  "Something in", "Whatever is under", "A bad smell from", "Nobody will walk",
  "The lights are back at", "Three complaints about", "Second attempt:", "Nothing left at",
];

const ERRANDS = [
  "Walk", "Ward", "Survey", "Clear", "Watch", "Count the losses at", "Escort the assessor to",
  "Recover what is left of",
];

/** Which beasts a region has. The same ranges the sightings relation uses, so the two agree. */
const RANGE: Record<Region, BeastId[]> = {
  Thornmarch: ["grimalkin", "wyrm", "mimic", "stoneback"],
  Saltmere: ["harpy", "stoneback", "mimic", "revenant"],
  "Ashfall Reach": ["basilisk", "revenant", "harpy", "wyrm"],
  Coldiron: ["revenant", "wyrm", "mimic", "basilisk"],
  Greenhollow: ["boghound", "mimic", "grimalkin", "revenant"],
  Duskfen: ["boghound", "grimalkin", "revenant", "stoneback"],
};

const PARTY_BY_GRADE: Record<Grade, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const REWARD_BY_GRADE: Record<Grade, number> = { 1: 6, 2: 14, 3: 32, 4: 68, 5: 145 };

/** Eight years of history, oldest first. */
const SPAN_DAYS = 8 * 365;

function build(): ArchivedQuest[] {
  const random = rng(0xa7c1);

  // Each member owes the archive exactly as many appearances as the roster claims they have
  // settled. When a quota reaches zero that member stops being drawn, so the last contracts are
  // crewed by whoever is left — which is why the oldest names thin out at the end of the run.
  const quota = new Map<string, number>(MEMBERS.map((m) => [m.id, m.settled]));
  const remaining = () => MEMBERS.filter((m) => (quota.get(m.id) ?? 0) > 0);

  const out: ArchivedQuest[] = [];

  while (remaining().length > 0) {
    const pool = remaining();

    // Grade is chosen from what the pool can actually crew, so the loop always terminates: a pool
    // of two can never be asked for a party of five.
    const ceiling = Math.min(5, pool.length) as Grade;
    const grade = Math.min(
      ceiling,
      random.weighted([1, 2, 3, 4, 5], [22, 30, 26, 16, 6]),
    ) as Grade;

    // The hall with the most quota left posts it — history balances itself.
    const byHall = HALLS.map((entry) => ({
      id: entry.id as HallId,
      left: pool.filter((m) => m.hall === entry.id).length,
    })).sort((a, b) => b.left - a.left);
    const hall = random.weighted(
      byHall.map((entry) => entry.id),
      byHall.map((entry) => entry.left + 1),
    );

    const region = random.pick(REGIONS);
    const beast = random.chance(0.72) ? random.pick(RANGE[region]) : undefined;

    const party = drawParty(pool, hall, PARTY_BY_GRADE[grade], random, quota);
    if (party.length === 0) break;

    out.push({
      id: "",
      title: title(beast, random),
      hall,
      region,
      ...(beast ? { beast } : {}),
      grade,
      outcome: random.chance(0.86) ? "settled" : "failed",
      reward: Math.round(REWARD_BY_GRADE[grade] * random.float(0.9, 1.15)),
      closedDayOffset: -random.int(70, SPAN_DAYS),
      party,
      tags: random.sample(TAGS, random.int(1, 3)) as Tag[],
      reports: beast ? random.int(0, 4) : random.int(0, 2),
    });
  }

  // Oldest first, then numbered — so `A-0001` really is the oldest thing the hall remembers.
  out.sort((a, b) => a.closedDayOffset - b.closedDayOffset);
  return out.map((entry, index) => ({
    ...entry,
    id: `A-${String(index + 1).padStart(4, "0")}`,
  }));
}

function title(beast: BeastId | undefined, random: ReturnType<typeof rng>): string {
  const place = random.pick(PLACES);
  if (beast) {
    const label = BEASTS.find((entry) => entry.id === beast)?.label ?? "Something";
    return random.chance(0.5)
      ? `${label} at ${place}`
      : `${random.pick(OPENINGS)} ${place}`;
  }
  return `${random.pick(ERRANDS)} ${place}`;
}

/** Home hall first, borrowing when short — and every pick spends a slot of that member's quota. */
function drawParty(
  pool: readonly Member[],
  hall: HallId,
  wanted: number,
  random: ReturnType<typeof rng>,
  quota: Map<string, number>,
): MemberId[] {
  const ordered = [
    ...random.shuffle(pool.filter((m) => m.hall === hall)),
    ...random.shuffle(pool.filter((m) => m.hall !== hall)),
  ];

  const picked: MemberId[] = [];
  for (const candidate of ordered) {
    if (picked.length === wanted) break;
    picked.push(candidate.id as MemberId);
    quota.set(candidate.id, (quota.get(candidate.id) ?? 0) - 1);
  }
  return picked;
}

export const ARCHIVE: readonly ArchivedQuest[] = build();

/** Every contract a member ever closed — the reason their `settled` number is what it is. */
export function archiveOf(memberId: string): ArchivedQuest[] {
  return ARCHIVE.filter((entry) => entry.party.some((id) => id === memberId));
}

export function archiveIn(region: Region): ArchivedQuest[] {
  return ARCHIVE.filter((entry) => entry.region === region);
}

/** Node count a graph built from the archive will have, before edges. */
export function archiveScale(): { contracts: number; reports: number; nodes: number } {
  const contracts = ARCHIVE.length;
  const reports = ARCHIVE.reduce((total, entry) => total + entry.reports, 0);
  return {
    contracts,
    reports,
    nodes: contracts + reports + MEMBERS.length + BEASTS.length + REGIONS.length + TAGS.length,
  };
}
