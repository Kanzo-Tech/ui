// The board — forty-four contracts, which is the fixture most of the docs actually renders.
//
// Split deliberately: the **titles, places, grades and tags are authored**, and everything a
// reader would not notice being wrong — ids, rewards, dates, parties — is derived from one seeded
// stream. Authoring the whole thing by hand produces a table nobody wants to read; generating the
// whole thing produces "Quest 17" against "Region 3", which teaches a reader nothing and lets a
// broken sort look correct.
//
// The derived half is not arbitrary either. Reward tracks grade and then travel distance, because
// a numeric column that does not correlate with anything cannot demonstrate a sort. Party size
// tracks grade. Some contracts are overdue and some are terminal, so a row action that is only
// legal on an open contract has both cases to show. Forty-four rows is five pages at ten a page —
// enough that pagination is doing something and few enough that the last page is not a stub.

import { rng } from "@/lib/rng";
import { member, membersOf, MEMBERS, type Member, type MemberId } from "./people";
import {
  type BeastId,
  type Grade,
  type HallId,
  HALLS,
  isoDay,
  type QuestStatusId,
  type Region,
  REGION_DISTANCE,
  type Tag,
} from "./world";

export interface Quest {
  /** `Q-1041`, ascending in posting order — a stable, sortable, human-quotable key. */
  id: string;
  title: string;
  /** The hall that posted it, which is not necessarily the hall that claimed it. */
  hall: HallId;
  region: Region;
  /** Absent for escort, survey and ledger work — not every contract has something to kill. */
  beast?: BeastId;
  grade: Grade;
  status: QuestStatusId;
  /** Gold. Tracks grade first, travel second. */
  reward: number;
  /** Days relative to `TODAY`; negative is the past. */
  postedDayOffset: number;
  dueDayOffset: number;
  /** Empty while the contract is still open. */
  party: MemberId[];
  tags: Tag[];
  /** Reported encounters, which is what the sightings relation counts by contract. */
  sightings: number;
}

interface Spec {
  title: string;
  hall: HallId;
  region: Region;
  beast?: BeastId;
  grade: Grade;
  tags: Tag[];
  /** Pinned when the narrative needs this exact state — see `PINNED` below. */
  status?: QuestStatusId;
  /** Pinned party, for the contracts the rule examples reason about. */
  party?: MemberId[];
  /** Pinned to make the row overdue. */
  dueDayOffset?: number;
}

/**
 * The authored half.
 *
 * Titles carry the world: they are what a reader quotes back, and the reason a table of forty-four
 * rows is worth scrolling. They are also the honest test of a text cell — real titles are long,
 * unequal, contain punctuation, and one of them will always be too wide for the column.
 */
const SPECS: readonly Spec[] = [
  // Thornmarch — the Amber Hall's own ground: the most contracts, the mildest grades.
  { title: "Something is eating the bell-ropes", hall: "amber", region: "Thornmarch", beast: "grimalkin", grade: 2, tags: ["night-work", "bring-rope"] },
  { title: "A wyrm under the granary", hall: "amber", region: "Thornmarch", beast: "wyrm", grade: 3, tags: ["underground", "livestock"] },
  { title: "Nine goats, one road", hall: "amber", region: "Thornmarch", grade: 1, tags: ["escort", "livestock"] },
  { title: "The miller's second cellar", hall: "amber", region: "Thornmarch", beast: "mimic", grade: 2, tags: ["underground", "survey"] },
  { title: "The orchard is counting wrong", hall: "amber", region: "Thornmarch", grade: 2, tags: ["survey", "cartography"] },
  { title: "Escort the assessor as far as the ford", hall: "amber", region: "Thornmarch", grade: 1, tags: ["escort"] },
  { title: "A stoneback has taken the lower ford", hall: "amber", region: "Thornmarch", beast: "stoneback", grade: 3, tags: ["standing-water"] },
  { title: "Audit the Ash & Co. expense ledger", hall: "amber", region: "Thornmarch", grade: 1, tags: ["hall-honours"] },

  // Saltmere — the Order of Salt. Coastal, wet, and administratively fussy.
  { title: "The tide brought back the wrong boat", hall: "salt", region: "Saltmere", grade: 3, tags: ["coastal", "recovery"] },
  { title: "Whatever is in the salt-house, it is not salt", hall: "salt", region: "Saltmere", beast: "mimic", grade: 3, tags: ["coastal", "sealed-orders"] },
  { title: "The lighthouse keeper has stopped answering", hall: "salt", region: "Saltmere", beast: "revenant", grade: 4, tags: ["coastal", "night-work", "warding"] },
  { title: "Three fords, one stoneback", hall: "salt", region: "Saltmere", beast: "stoneback", grade: 3, tags: ["standing-water", "cartography"] },
  { title: "Harpies above the cliff road", hall: "salt", region: "Saltmere", beast: "harpy", grade: 4, tags: ["escort", "coastal"] },
  { title: "Survey the drowned quarter before the spring tide", hall: "salt", region: "Saltmere", grade: 2, tags: ["survey", "standing-water", "cartography"] },
  { title: "Do not let the assessor drink the sample", hall: "salt", region: "Saltmere", grade: 1, tags: ["escort", "hall-honours"] },

  // Ashfall Reach — Ash & Company's ground, and the reason its roster is the most wounded.
  { title: "The quarry has opened onto something", hall: "ash", region: "Ashfall Reach", beast: "basilisk", grade: 5, tags: ["underground", "warding", "no-open-flame"] },
  { title: "Recover the seal from the burned wing", hall: "ash", region: "Ashfall Reach", grade: 3, tags: ["recovery", "no-open-flame"] },
  { title: "A basilisk, and it knows the route", hall: "ash", region: "Ashfall Reach", beast: "basilisk", grade: 5, tags: ["bounty", "second-attempt"] },
  { title: "Cold work at the smelter", hall: "ash", region: "Ashfall Reach", beast: "revenant", grade: 4, tags: ["warding", "night-work"] },
  { title: "The road above the cliffs, again", hall: "ash", region: "Ashfall Reach", beast: "harpy", grade: 3, tags: ["escort", "second-attempt"] },
  { title: "Map what is left of the upper galleries", hall: "ash", region: "Ashfall Reach", grade: 2, tags: ["survey", "underground", "cartography"] },
  { title: "Standing bounty: revenants, any region", hall: "ash", region: "Ashfall Reach", beast: "revenant", grade: 4, tags: ["bounty", "warding"] },

  // Coldiron — The Nine. Sealed orders, wards, and a great deal of counting.
  { title: "The ward on the north gate went out", hall: "nine", region: "Coldiron", beast: "revenant", grade: 4, tags: ["warding", "winter"] },
  { title: "Count the graves at Coldiron and report", hall: "nine", region: "Coldiron", grade: 2, tags: ["survey", "winter", "sealed-orders"] },
  { title: "Sealed orders. Do not open them.", hall: "nine", region: "Coldiron", grade: 3, tags: ["escort", "sealed-orders"] },
  { title: "The locksmith's own door", hall: "nine", region: "Coldiron", beast: "mimic", grade: 3, tags: ["bring-rope", "no-magic"] },
  { title: "Winter survey: the upper terraces", hall: "nine", region: "Coldiron", grade: 2, tags: ["survey", "winter", "cartography"] },
  { title: "A wyrm has found the forge-flues", hall: "nine", region: "Coldiron", beast: "wyrm", grade: 4, tags: ["underground", "no-open-flame"] },
  { title: "Escort the charter to Thornmarch", hall: "nine", region: "Coldiron", grade: 2, tags: ["escort", "hall-honours", "sealed-orders"] },

  // Greenhollow — no hall of its own, so the work is shared out. Mild, populated, awkward.
  { title: "The children say the well talks", hall: "amber", region: "Greenhollow", beast: "revenant", grade: 3, tags: ["children-present", "warding", "standing-water"] },
  { title: "Mimics in the tithe-barn", hall: "amber", region: "Greenhollow", beast: "mimic", grade: 2, tags: ["livestock"] },
  { title: "Map the drowned lane", hall: "lanternwood", region: "Greenhollow", grade: 2, tags: ["survey", "standing-water", "cartography"] },
  { title: "Second attempt: the drowned lane", hall: "lanternwood", region: "Greenhollow", grade: 3, tags: ["survey", "second-attempt", "standing-water"] },
  { title: "Bog-hounds took the herd dog", hall: "amber", region: "Greenhollow", beast: "boghound", grade: 2, tags: ["livestock", "standing-water"] },
  { title: "The hedge has moved eleven feet", hall: "lanternwood", region: "Greenhollow", grade: 1, tags: ["survey", "cartography"] },
  { title: "Grimalkin, but only at dusk", hall: "amber", region: "Greenhollow", beast: "grimalkin", grade: 2, tags: ["night-work", "children-present"] },

  // Duskfen — the Lanternwood Compact. Someone has to walk it.
  { title: "Walk the lantern-line before the frost", hall: "lanternwood", region: "Duskfen", grade: 2, tags: ["night-work", "winter", "warding"] },
  { title: "Something is relighting the lamps", hall: "lanternwood", region: "Duskfen", beast: "revenant", grade: 4, tags: ["night-work", "warding", "no-magic"] },
  { title: "Grimalkin on the chapel roof", hall: "lanternwood", region: "Duskfen", beast: "grimalkin", grade: 2, tags: ["bring-rope", "night-work"] },
  { title: "Retrieve the surveyor's kit, and the surveyor", hall: "lanternwood", region: "Duskfen", beast: "boghound", grade: 3, tags: ["recovery", "standing-water"] },
  { title: "The ferryman wants a warden present", hall: "lanternwood", region: "Duskfen", grade: 1, tags: ["escort", "standing-water"] },
  { title: "Bog-hounds, in threes, along the causeway", hall: "salt", region: "Duskfen", beast: "boghound", grade: 3, tags: ["bounty", "standing-water"] },
  { title: "The lamp-oil accounts do not add up", hall: "lanternwood", region: "Duskfen", grade: 1, tags: ["hall-honours"] },
  { title: "Whatever walks the causeway, it is not a lamp", hall: "lanternwood", region: "Duskfen", beast: "revenant", grade: 5, tags: ["night-work", "warding", "sealed-orders"] },
];

/**
 * The contracts whose state is fixed, because something else in the docs points at them.
 *
 * Keyed by title so a reordering of `SPECS` cannot silently re-pin the wrong row. Each entry earns
 * its place by being *referred to* somewhere:
 *
 * - the two `failed` ones are what the graph's dead-ends and the alert examples talk about;
 * - "A basilisk, and it knows the route" is grade 5 with a party of two and no cantor, which is the
 *   contract `rules.ts` rejects — the rule example needs a real violation, not a hypothetical one;
 * - Fenn Aldabra is `missing` on the roster, so the contract Fenn is on must still be `afield`,
 *   or the world contradicts itself in two places a reader can see at once.
 */
const PINNED: Record<string, Partial<Spec>> = {
  // Grade 5, a party of two, no cantor, six days overdue, and one of the two is hurt. This is the
  // contract every "something is wrong" example points at, and the one `rules.ts` rejects.
  "A basilisk, and it knows the route": {
    status: "afield",
    party: ["roe", "solveig"],
    dueDayOffset: -6,
  },
  // The counter-example: the same grade, staffed properly, and borrowed across four halls — which
  // is how a reader learns that the party column is not per-hall. Deliberately draws nobody from
  // the Amber Hall, which every showcase opens on and which must not read as evacuated.
  "The quarry has opened onto something": {
    status: "afield",
    party: ["grieve", "vrana", "yusra", "faisal", "lyle"],
  },
  // Fenn is `missing`; the contract Fenn is on must therefore still be live, or the roster and the
  // board contradict each other on two screens a reader can open side by side.
  "Something is relighting the lamps": {
    status: "afield",
    party: ["fenn", "ansel", "beatrix"],
    dueDayOffset: -2,
  },
  "The children say the well talks": { status: "claimed", party: ["ravenna", "bell", "miren"] },
  // A failure and its re-posting, so the board shows the same job twice in two states.
  "Map the drowned lane": { status: "failed", party: ["wren", "silas"] },
  "Second attempt: the drowned lane": { status: "open", party: [] },
  "The road above the cliffs, again": { status: "failed", party: ["kestrel", "rui", "emrys"] },
  "Nine goats, one road": { status: "settled", party: ["quill"] },
  // `Q-1041`, the first row, is open — so the first thing anyone sees is claimable.
  "Something is eating the bell-ropes": { status: "open", party: [] },
};

/** Reward floor by grade. A writ pays twenty times an errand, and the table should show it. */
const REWARD_BY_GRADE: Record<Grade, number> = { 1: 6, 2: 14, 3: 32, 4: 68, 5: 145 };

/** Party size by grade — what the rule in `rules.ts` is written against. */
const PARTY_BY_GRADE: Record<Grade, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

/**
 * How often each state comes up, for the contracts that are not pinned.
 *
 * Weighted, not uniform: uniform weights give every facet the same count, which is exactly the
 * shape that hides a broken filter. Mostly settled, because a board is mostly history.
 *
 * The live weights are bounded twice, and both bounds were found by looking rather than by
 * reasoning. Too *many* live contracts and the generator runs out of people, downgrades the
 * surplus for want of a party and lands the board at 57% open. Too many again — and this one is
 * only visible on screen — and the roster reads "Afield" on thirty rows out of thirty-five, which
 * is not a guild, it is an evacuation, and it leaves a "claim this contract" control with nobody
 * to offer. Nine live contracts commit roughly half the hall; these weights hold it there.
 */
const STATUS_WEIGHTS: Record<QuestStatusId, number> = {
  open: 31,
  claimed: 4,
  afield: 6,
  settled: 44,
  failed: 15,
};

const STATUS_IDS = Object.keys(STATUS_WEIGHTS) as QuestStatusId[];

/**
 * The roster, widened.
 *
 * `MEMBERS` is `as const` so that `MemberId` is a real union; the cost is that a member with no
 * `condition` key has no such property to read. This is the same array seen as `Member`.
 */
const ROSTER_ALL: readonly Member[] = MEMBERS;

/** Claimed and afield are *live* — the party is committed and cannot be committed twice. */
function isLive(status: QuestStatusId): boolean {
  return status === "claimed" || status === "afield";
}

function build(): Quest[] {
  // One stream for the whole board, drawn in `SPECS` order. Any edit to a spec above shifts the
  // derived half of every later row, which is fine and deliberate: the fixture is regenerated as a
  // unit, and the snapshot test is what notices.
  const random = rng(0x9d5c);

  // Nobody is on two live contracts at once. The pinned parties reserve their members before any
  // are drawn, so an authored narrative always wins over a generated one.
  const committed = new Set<string>();
  for (const base of SPECS) {
    const pin = PINNED[base.title];
    if (pin?.party && pin.status && isLive(pin.status)) {
      for (const id of pin.party) committed.add(id);
    }
  }

  const specs = SPECS.map((base) => ({ ...base, ...PINNED[base.title] }));

  const status: QuestStatusId[] = specs.map(
    (spec) =>
      spec.status ?? random.weighted(STATUS_IDS, STATUS_IDS.map((id) => STATUS_WEIGHTS[id])),
  );

  // Parties are allocated in a **shuffled** order, not board order.
  //
  // In board order the roster ran dry near the end, so every contract in the last region on the
  // list came out unstaffed — Duskfen was 100% open while Thornmarch was fully crewed, purely
  // because of where it sat in the array. That is invisible in a table and glaring in a chart
  // binned by region, which is exactly the class of artefact a shared fixture must not have.
  const party: MemberId[][] = specs.map(() => []);
  for (const index of random.shuffle(specs.map((_, i) => i))) {
    const spec = specs[index];
    party[index] = spec.party ?? draw(spec, status[index], random, committed);

    // Nobody left to send. The contract does not get a phantom party — it stays on the board, which
    // is the honest outcome and the reason the five halls between them cannot clear it. It is also
    // why Lanternwood was invited in the first place.
    if (isLive(status[index]) && party[index].length === 0) status[index] = "open";
    if (isLive(status[index])) for (const id of party[index]) committed.add(id);
  }

  return specs.map((spec, index) => {
    // Travel is a real premium: eleven days to Ashfall Reach is eleven days nobody is at home.
    const travel = 1 + REGION_DISTANCE[spec.region] * 0.04;
    const reward = Math.round(REWARD_BY_GRADE[spec.grade] * travel * random.float(0.9, 1.15));

    // Open work is recent; settled work is old. A board where every date is the same week cannot
    // demonstrate a date sort, and a relative-time cell needs both "2 days" and "7 months".
    const postedDayOffset =
      status[index] === "open" ? -random.int(0, 18)
      : status[index] === "settled" || status[index] === "failed" ? -random.int(60, 240)
      : -random.int(10, 55);

    const dueDayOffset = spec.dueDayOffset ?? postedDayOffset + random.int(14, 60);

    return {
      id: `Q-${1041 + index}`,
      title: spec.title,
      hall: spec.hall,
      region: spec.region,
      ...(spec.beast ? { beast: spec.beast } : {}),
      grade: spec.grade,
      status: status[index],
      reward,
      postedDayOffset,
      dueDayOffset,
      party: party[index],
      tags: spec.tags,
      sightings: spec.beast ? random.int(1, 4 * spec.grade) : 0,
    } satisfies Quest;
  });
}

/**
 * A plausible party: the posting hall first, borrowing when short-handed.
 *
 * Who is eligible depends on whether the contract is history or in progress. A settled contract
 * may name anyone — it happened, and whoever is hurt now was not hurt then. A live one may only
 * name members who are neither committed elsewhere nor carrying a condition, which is what stops
 * the roster saying "Wounded" beside a member the board has just sent out.
 */
function draw(
  spec: Spec,
  status: QuestStatusId,
  random: ReturnType<typeof rng>,
  committed: ReadonlySet<string>,
): MemberId[] {
  if (status === "open") return [];

  const wanted = PARTY_BY_GRADE[spec.grade];

  // History may name anyone: it happened, and whoever is hurt now was not hurt then.
  if (!isLive(status)) return random.sample(ROSTER_ALL, wanted).map((c) => c.id as MemberId);

  // No hall sends out more than half its people at once.
  //
  // Without this the Amber Hall emptied: it posts the most contracts, parties draw from home first,
  // and its whole roster came back "Afield" — on the one hall every showcase opens on, leaving a
  // "claim this contract" control with nobody to offer. The cap is a fact about the world (a hall
  // that sends everyone has no hall) doing double duty as the fix.
  //
  // It has to bound the draw rather than gate it. Gating — skip a hall that is already at its cap —
  // still let one grade-5 contract take five members from a hall standing at zero, blowing straight
  // past the cap in a single party.
  const room = new Map(
    HALLS.map((entry) => {
      const roster = membersOf(entry.id);
      const out = roster.filter((c) => committed.has(c.id)).length;
      return [entry.id, Math.max(0, Math.floor(roster.length / 2) - out)] as const;
    }),
  );

  // Home first, then whoever else is free — which is why a party column crosses halls, and why the
  // biggest contract on the board carries five names from four charters.
  const pool = [
    ...random.shuffle(membersOf(spec.hall)),
    ...random.shuffle(ROSTER_ALL.filter((c) => c.hall !== spec.hall)),
  ];

  const picked: MemberId[] = [];
  for (const candidate of pool) {
    if (picked.length === wanted) break;
    if (candidate.condition !== undefined || committed.has(candidate.id)) continue;
    const spare = room.get(candidate.hall) ?? 0;
    if (spare <= 0) continue;
    room.set(candidate.hall, spare - 1);
    picked.push(candidate.id as MemberId);
  }
  return picked;
}

export const QUESTS: readonly Quest[] = build();

export function quest(id: string): Quest {
  const found = QUESTS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such quest: ${id}`);
  return found;
}

function byTitle(title: string): Quest {
  const found = QUESTS.find((candidate) => candidate.title === title);
  if (!found) throw new Error(`No contract titled: ${title}`);
  return found;
}

/**
 * The contracts the documentation points at by name.
 *
 * Ids are positional — `Q-${1041 + index}` — so an example that hard-codes `"Q-1058"` is really
 * saying "the eighteenth spec", and inserting a contract above it silently re-points the sentence
 * at a different one. These are resolved by title, which is authored and stable, so a reorder
 * either keeps working or throws at import.
 *
 * Use these anywhere prose and fixture have to agree.
 */
export const FEATURED = {
  /** Q-1041, the first row on the board: open, claimable, grade 2. */
  open: byTitle("Something is eating the bell-ropes"),
  /** The one everything wrong points at: grade 5, six days overdue, two people, no cantor. */
  overdue: byTitle("A basilisk, and it knows the route"),
  /** Its opposite: the same grade, staffed properly, borrowed across four halls. */
  writ: byTitle("The quarry has opened onto something"),
  /** A failure, and the re-posting that followed it. */
  failed: byTitle("Map the drowned lane"),
  reposted: byTitle("Second attempt: the drowned lane"),
  /** Signed, not yet left. */
  claimed: byTitle("The children say the well talks"),
} as const;

/** The board as a hall sees it — every screen that opens on one hall starts here. */
export function questsOf(hall: HallId): Quest[] {
  return QUESTS.filter((candidate) => candidate.hall === hall);
}

export function openQuests(): Quest[] {
  return QUESTS.filter((candidate) => candidate.status === "open");
}

/**
 * Out, and past the date it was due back.
 *
 * A predicate rather than only a filtered list, because an example filtering a *subset* of the
 * board cannot reuse `overdueQuests()` and was restating `dueDayOffset < 0` inline instead.
 */
export function isOverdue(candidate: Quest): boolean {
  return candidate.status === "afield" && candidate.dueDayOffset < 0;
}

/** Afield and past its due date — the row an alert, a toast or a warning cell points at. */
export function overdueQuests(): Quest[] {
  return QUESTS.filter(isOverdue);
}

/** `Q-1041 · Something is eating the bell-ropes` — the one-line form, assembled once. */
export function questLabel(candidate: Quest): string {
  return `${candidate.id} · ${candidate.title}`;
}

/** The party, resolved. Saves every caller mapping ids through `member()` to print a name. */
export function partyOf(candidate: Quest): Member[] {
  return candidate.party.map((id) => member(id));
}

/**
 * Days past due, or 0 if it is not.
 *
 * Exists because "six days overdue" was hand-written in four examples. It is only
 * `-dueDayOffset`, but a number typed into prose is exactly the drift `TODAY` was introduced to
 * prevent: change one contract's date and four pages start lying.
 */
export function daysOverdue(candidate: Quest): number {
  return Math.max(0, -candidate.dueDayOffset);
}

export function postedOn(candidate: Quest): string {
  return isoDay(candidate.postedDayOffset);
}

export function dueOn(candidate: Quest): string {
  return isoDay(candidate.dueDayOffset);
}

/** Facet counts, which is what a `FacetFilter` label needs and what a bar chart bins. */
export function countBy<K extends string>(key: (candidate: Quest) => K): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const candidate of QUESTS) {
    const bucket = key(candidate);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

/** Total gold the board is carrying, for the one stat tile that has to be a sum. */
export function boardValue(status?: QuestStatusId): number {
  return QUESTS.filter((candidate) => !status || candidate.status === status).reduce(
    (total, candidate) => total + candidate.reward,
    0,
  );
}

/** Every hall id that posted at least one contract, in `HALLS` order. */
export function postingHalls(): HallId[] {
  return HALLS.map((entry) => entry.id).filter((id) =>
    QUESTS.some((candidate) => candidate.hall === id),
  );
}
