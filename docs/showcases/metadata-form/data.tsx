// Fixtures for the metadata-form showcase — posting a contract to the Guild board.
//
// The design system owns error PRESENTATION, never error PRODUCTION (see DESIGN.md and
// `.planning/FORMS-DECISION.md`): `Field` takes a boolean + a `ReactNode`, and where the boolean
// came from is the product's business. So the whole rule engine is FAKED here — a plain
// `validate(values)` that walks a posting-shaped value object and returns `Issue[]`, exactly the
// way the discovery showcase fakes its graph. No rule language, no interpreter, no
// `@kanzo-tech/ui` domain leak — just fixtures over `@/example`.
//
// Four of the checks are not invented, though. `@/example/rules` publishes the Amber Hall's
// standing orders as source — the same text the Source panel shows — and the messages below are
// READ OUT OF IT rather than copied, so the panel on the left and the errors on the form cannot
// drift apart.

import type { Suggestion } from "@kanzo-tech/ui";
import { MEMBERS, member, membersOf } from "@/example/people";
import { FEATURED, type Quest, dueOn, postedOn, questLabel } from "@/example/quests";
import { ROSTER, availableNow } from "@/example/roster";
import { RULES_SOURCE } from "@/example/rules";
import {
  AVAILABILITY,
  BEASTS,
  GRADES,
  HALLS,
  RANKS,
  REGION_DISTANCE,
  REGIONS,
  ROLES,
  type Tag,
  hall,
  isoDay,
  role,
} from "@/example/world";

// The world's accessors — `hall()`, `beast()`, `grade()`, `role()` — throw on an unknown id, which
// is right for a fixture and wrong for a form: a half-filled select holds "", and a value the user
// is in the middle of choosing is a state the form is allowed to be in. So every lookup off a form
// value goes through one of these, and every lookup off a `Quest` keeps the throwing accessor.
const hallById = (id: string) => HALLS.find((entry) => entry.id === id) ?? null;
const beastById = (id: string) => BEASTS.find((entry) => entry.id === id) ?? null;
const roleById = (id: string) => ROLES.find((entry) => entry.id === id) ?? null;
const gradeOf = (value: string) => GRADES.find((entry) => String(entry.value) === value) ?? null;
const DISTANCE: Record<string, number> = REGION_DISTANCE;

// ── The shape ────────────────────────────────────────────────────────────────

export type Severity = "violation" | "warning" | "info";

export type GroupId = "work" | "posting" | "terms" | "party";

/** The four sections a posting is filled in, in the order the board reads them. */
export interface Group {
  id: GroupId;
  label: string;
}

export const GROUPS: Group[] = [
  { id: "work", label: "The work" },
  { id: "posting", label: "The posting" },
  { id: "terms", label: "The terms" },
  { id: "party", label: "The party" },
];

/** A repeatable single value (a tag, a beast, an invited hall, a waypoint). Carries a stable `id`
 *  so `FieldArray` keeps focus across edits — never key a row by its index. */
export interface Entry {
  id: string;
  value: string;
}

/** Who posts it and pays for it — a compound object, 0..1, and the board will not take it without
 *  a hall. */
export interface Poster {
  /** A `HallId`, or "" while nothing is chosen. */
  hall: string;
  /** Who signs for it: a member's handle, checked against the roster. */
  handle: string;
  /** Where the party reports. Free text — the hall's seat is only the obvious answer. */
  muster: string;
}

/** Who to ask on arrival — a compound object, repeatable. */
export interface Steward {
  id: string;
  who: string;
  handle: string;
}

/** One name on the contract — a compound object, repeatable, and what the standing orders count. */
export interface Signatory {
  id: string;
  /** A `MemberId`, or "" on a fresh row. */
  member: string;
  /**
   * The duty they are signed for.
   *
   * Filled from the member's own role when one is picked, and then editable: a hall may sign a
   * scout to hold a line, and the standing orders read what the contract *claims*, not what the
   * roster says. Deriving it and allowing the override is the only honest version — restating the
   * role in a second field would be two sources of truth for one fact.
   */
  duty: string;
  /** What was agreed. Free text; the board does not parse it. */
  terms: string;
}

export interface FormValues {
  title: string; // writ:title
  notices: Entry[]; // writ:notice
  tags: Entry[]; // writ:tag
  beasts: Entry[]; // writ:beast
  region: string; // writ:region
  grade: string; // writ:grade
  posted: string | null; // writ:posted
  due: string | null; // writ:due
  poster: Poster | null; // writ:poster
  stewards: Steward[]; // writ:ask
  invited: Entry[]; // writ:invited
  orders: string; // writ:orders
  reward: string; // writ:reward
  waypoints: Entry[]; // writ:waypoint
  party: Signatory[]; // writ:party
}

// ── Controlled vocabularies (the `Select` sources) ───────────────────────────
// Every one of these is the world's own list. A showcase that retyped the six regions would be
// one edit away from offering a seventh nobody has ever heard of.

export const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  ...REGIONS.map((region) => ({
    value: region,
    label: `${region} · ${REGION_DISTANCE[region]} days from the Amber Hall`,
  })),
];

export const GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a grade…" },
  ...GRADES.map((entry) => ({ value: String(entry.value), label: `${entry.value} — ${entry.label}` })),
];

export const BEAST_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a beast…" },
  ...BEASTS.map((entry) => ({ value: entry.id, label: `${entry.label} · ${entry.kind}` })),
];

export const HALL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a hall…" },
  ...HALLS.map((entry) => ({ value: entry.id, label: entry.name })),
];

export const DUTY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a duty…" },
  ...ROLES.map((entry) => ({ value: entry.id, label: `${entry.label} — ${entry.duty}` })),
];

/**
 * Everyone who could be put on a contract, ready first.
 *
 * Not `availableNow()` alone: the board holds contracts whose parties went out weeks ago, and a
 * select that cannot show its own value is a select that silently blanks it. So the whole roster is
 * offered, ordered by who can actually go, and the ones who cannot say why in the option itself.
 */
const availabilityLabel = (id: string) =>
  AVAILABILITY.find((state) => state.id === id)?.label ?? id;

export const PARTY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a member…" },
  ...[
    ...availableNow(),
    ...ROSTER.filter((entry) => entry.availability !== "ready"),
  ].map((entry) => ({
    value: entry.id,
    label:
      entry.availability === "ready"
        ? `${entry.name} · ${role(entry.role).label}`
        : `${entry.name} · ${role(entry.role).label} (${availabilityLabel(entry.availability)})`,
  })),
];

/** The duty a member carries on the roster — what a fresh signatory row is filled with. */
export const dutyOf = (id: string) => MEMBERS.find((entry) => entry.id === id)?.role ?? "";

// ── Stable-id helper ─────────────────────────────────────────────────────────

let seq = 0;
/** A stable row id. Not `crypto.randomUUID()` — that is not needed and this keeps the
 *  fixtures deterministic on the server render. */
export const uid = (prefix = "row") => `${prefix}-${(seq += 1)}`;

// ── The seeded postings (the `Contract` switcher in the top strip) ───────────

export const BLANK: FormValues = {
  title: "",
  notices: [],
  tags: [],
  beasts: [],
  region: "",
  grade: "",
  posted: null,
  due: null,
  poster: null,
  stewards: [],
  invited: [],
  orders: "",
  reward: "",
  waypoints: [],
  party: [],
};

/** A warden signs for the party (`ROLES`), so that is who the board has on the sheet. */
function signatoryOf(quest: Quest): string {
  const party = quest.party.map((id) => member(id));
  const signs = party.find((candidate) => candidate.role === "warden") ?? party[0];
  return signs?.handle ?? "";
}

/** An archivist reads the contract before anyone signs it, which makes them the one to ask. */
function clerkOf(quest: Quest): Steward[] {
  const clerk = membersOf(quest.hall).find((candidate) => candidate.role === "archivist");
  return clerk ? [{ id: uid("ask"), who: clerk.name, handle: clerk.handle }] : [];
}

/**
 * A contract on the board, read into the form.
 *
 * Everything but the two prose fields is projected from the `Quest` itself — a form that retyped
 * the reward, the region or the party would be showing a copy of the board rather than the board.
 * The notice and the standing orders are the poster's own words, which the world does not store,
 * so they are the only authored strings here.
 */
function fromQuest(quest: Quest, notice: string, orders: string): FormValues {
  return {
    title: quest.title,
    notices: [{ id: uid("n"), value: notice }],
    tags: quest.tags.map((tag) => ({ id: uid("t"), value: tag })),
    beasts: quest.beast ? [{ id: uid("b"), value: quest.beast }] : [],
    region: quest.region,
    grade: String(quest.grade),
    posted: postedOn(quest),
    due: dueOn(quest),
    poster: {
      hall: quest.hall,
      handle: signatoryOf(quest),
      muster: hall(quest.hall).seat,
    },
    stewards: clerkOf(quest),
    invited: [],
    orders,
    reward: String(quest.reward),
    waypoints: [],
    party: quest.party.map((id) => ({
      id: uid("p"),
      member: id,
      duty: member(id).role,
      terms: "",
    })),
  };
}

export interface ContractOption {
  id: string;
  label: string;
  values: FormValues;
}

/**
 * Three postings, and each one is a different verdict.
 *
 * A blank sheet fails the three the board will not do without; `Q-1041` is what a clean posting
 * looks like; and the basilisk is the contract the world's own rule engine already rejects — grade
 * 5, two names, no cantor, six days past due. The last one is the reason the standing orders are
 * worth showing at all: they fire on real data, not on a hypothetical.
 */
export const CONTRACTS: ContractOption[] = [
  { id: "new", label: "New posting", values: BLANK },
  {
    id: FEATURED.open.id,
    label: questLabel(FEATURED.open),
    values: fromQuest(
      FEATURED.open,
      "Something is going through the bell-ropes and it is not rats. A grimalkin, by the state of the roof — they come at the turn of the season and leave again. Work after dark, and bring rope.",
      "Ring nothing. The ropes are to be cut down, not tested.",
    ),
  },
  {
    id: FEATURED.overdue.id,
    label: questLabel(FEATURED.overdue),
    values: fromQuest(
      FEATURED.overdue,
      "The same basilisk as the spring, and it has learned the road. It waits above the cut where the quarry track turns, which is where we lost the first party.",
      "Do not take the quarry track in daylight. Anyone who sees it first walks back and says so.",
    ),
  },
];

// ── The standing orders, read as data ────────────────────────────────────────

/**
 * Each rule's `else` clause, keyed by the rule's name.
 *
 * Parsed out of `RULES_SOURCE` rather than transcribed: the panel on the left of this showcase and
 * the error under a field are then the same sentence by construction. Rename a rule in the world
 * and `order()` throws at import instead of the form quietly enforcing something the orders no
 * longer say.
 */
const ORDERS: Record<string, string> = Object.fromEntries(
  [...RULES_SOURCE.matchAll(/rule "([^"]+)"[^}]*?else\s+"([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ]),
);

/** How many rules the board is checking — the count on the `Source` toggle. */
export const ORDER_COUNT = Object.keys(ORDERS).length;

/** The title line of the standing orders, as the ruleset selector shows it. */
export const ORDERS_LABEL = (RULES_SOURCE.split("\n")[0] ?? "")
  .replace(/^#\s*/, "")
  .replace(/\.$/, "");

function order(name: string): string {
  const message = ORDERS[name];
  if (!message) throw new Error(`No standing order named: ${name}`);
  return message;
}

// ── The faked rule engine ────────────────────────────────────────────────────

export interface Issue {
  /** Field key — how the summary and per-field lookup group issues. */
  field: string;
  /** Human field label — what the summary shows on the left. */
  label: string;
  group: GroupId;
  severity: Severity;
  /** The message the product resolved — the `ReactNode` the library will just display. */
  message: string;
}

const HANDLES = new Set<string>(MEMBERS.map((candidate) => candidate.handle));
/** `RANKS` is ordered cheapest first, which is the whole of what "rank >= silver" means. */
const RANK_ORDER: string[] = RANKS.map((entry) => entry.id);
const nonEmpty = (list: Entry[]) => list.some((entry) => entry.value.trim().length > 0);
const has = (values: FormValues, tag: Tag) =>
  values.tags.some((entry) => entry.value.trim() === tag);

/**
 * Stand-in for the engine the board would run over a posting. Deliberately returns a flat `Issue[]`
 * with resolved messages — the library never sees a rule, a clause or a severity term.
 *
 * Seeded so a blank sheet yields exactly the three the board will not do without (Title, Notice,
 * Poster), `Q-1041` yields no violation at all, and the basilisk yields the two breaches
 * `rules.ts` already reports for it. Nothing here reads the clock: `TODAY` is 14 September 1312 and
 * the dates are compared as ISO strings, which sort correctly and cannot drift into next year.
 */
export function validate(v: FormValues): Issue[] {
  const out: Issue[] = [];
  const add = (
    field: string,
    label: string,
    group: GroupId,
    severity: Severity,
    message: string,
  ) => out.push({ field, label, group, severity, message });

  // The work — what the board will not post without.
  if (!v.title.trim()) add("title", "Title", "work", "violation", "This field is required.");
  else if (v.title.trim().length < 6)
    add("title", "Title", "work", "warning", "A poster reads this from ten feet away.");

  if (!nonEmpty(v.notices))
    add("notices", "Notice", "work", "violation", "This field is required.");

  if (!nonEmpty(v.tags))
    add("tags", "Tags", "work", "info", "A contract with no tags is one nobody filters to.");

  if (!v.region) add("region", "Region", "work", "warning", "The board files by region.");
  if (!v.grade)
    add("grade", "Grade", "work", "warning", "Grade sets the fee, the party and half the orders.");

  // "children present" — a `forbid`, so it belongs to the tags rather than to any one of them.
  if (has(v, "children-present") && has(v, "no-open-flame"))
    add("tags", "Tags", "work", "violation", order("children present"));

  // The posting.
  if (!v.poster || !v.poster.hall)
    add("poster", "Poster", "posting", "violation", "This field is required.");
  if (v.poster?.handle.trim() && !HANDLES.has(v.poster.handle.trim()))
    add("poster", "Poster", "posting", "violation", "No member of the guild by that handle.");
  if (v.posted && v.posted > isoDay(0))
    add("posted", "Posted", "posting", "warning", "A contract cannot be posted after today.");
  if (v.due && v.posted && v.due < v.posted)
    add("due", "Due back", "posting", "warning", "It is due back before it was posted.");
  else if (v.due && v.due < isoDay(0))
    add("due", "Due back", "posting", "warning", "The due date has already passed.");
  v.stewards.forEach((steward, i) => {
    if (steward.handle.trim() && !HANDLES.has(steward.handle.trim()))
      add(
        "stewards",
        `Who to ask ${i + 1}`,
        "posting",
        "violation",
        "No member of the guild by that handle.",
      );
  });

  // The terms.
  const reward = v.reward.trim() ? Number(v.reward) : null;
  if (reward != null && (Number.isNaN(reward) || reward < 0))
    add("reward", "Reward", "terms", "violation", "Must be a non-negative number.");
  const posting = v.poster ? hallById(v.poster.hall) : null;
  if (!nonEmpty(v.invited) && posting)
    add("invited", "Halls invited", "terms", "info", `Nobody outside ${posting.short} may claim it.`);

  // The party — the standing orders, applied to what the contract claims.
  const signed = v.party.filter((row) => row.member);
  const duties = signed.map((row) => row.duty);
  const ranks = signed.map((row) => RANK_ORDER.indexOf(member(row.member).rank));
  const numericGrade = Number(v.grade) || 0;

  v.party.forEach((row, i) => {
    if (!row.member) {
      add("party", `Signatory ${i + 1}`, "party", "violation", "Somebody has to walk it.");
      return;
    }
    if (!row.duty)
      add("party", `Signatory ${i + 1}`, "party", "warning", "Say what they are signed for.");
    const condition = member(row.member).condition;
    if (condition)
      add(
        "party",
        `Signatory ${i + 1}`,
        "party",
        "warning",
        `${member(row.member).name} is ${availabilityLabel(condition).toLowerCase()}.`,
      );
    if (signed.filter((other) => other.member === row.member).length > 1)
      add("party", `Signatory ${i + 1}`, "party", "violation", "Nobody signs twice.");
  });

  if (numericGrade >= 5 && (signed.length < 4 || !duties.includes("warden")))
    add("party", "Party", "party", "violation", order("a writ needs a seal"));
  if (numericGrade >= 4 && !duties.includes("cantor"))
    add("party", "Party", "party", "violation", order("no ward left unlit"));
  if (has(v, "second-attempt") && ranks.length > 0 && Math.min(...ranks) < RANK_ORDER.indexOf("silver"))
    add("party", "Party", "party", "violation", order("the second attempt"));

  return out;
}

// ── The writ and the record (the `Output` panel) — derived from the values ───

const line = (label: string, value: string) => `${label.padEnd(8)}${value}`;

/** The slip as it would be pinned to the board. Not a serialisation format — a notice. */
export function toWrit(v: FormValues): string {
  const lines: string[] = [];
  if (v.title.trim()) lines.push(v.title.trim().toUpperCase());
  const posting = v.poster ? hallById(v.poster.hall) : null;
  if (posting && v.poster)
    lines.push(
      line("POSTED", [posting.name, v.poster.muster.trim(), v.posted ?? ""].filter(Boolean).join(" · ")),
    );
  if (v.due) lines.push(line("DUE", v.due));
  const graded = gradeOf(v.grade);
  if (graded) lines.push(line("GRADE", `${graded.value} — ${graded.label}`));
  if (v.region) lines.push(line("REGION", `${v.region} · ${DISTANCE[v.region] ?? "?"} days out`));
  if (v.reward.trim()) lines.push(line("REWARD", `${v.reward.trim()} gold`));
  const expect = v.beasts.map((entry) => beastById(entry.value)?.label).filter(Boolean);
  if (expect.length) lines.push(line("EXPECT", expect.join(", ")));
  const tags = v.tags.map((entry) => entry.value.trim()).filter(Boolean);
  if (tags.length) lines.push(line("TAGS", tags.join(", ")));
  const invited = v.invited.map((entry) => hallById(entry.value)?.short).filter(Boolean);
  if (invited.length) lines.push(line("OPEN TO", invited.join(", ")));
  const party = v.party
    .filter((row) => row.member)
    .map((row) => {
      const duty = roleById(row.duty);
      return `${member(row.member).name}${duty ? ` (${duty.label})` : ""}`;
    });
  if (party.length) lines.push(line("PARTY", party.join(", ")));
  for (const stop of v.waypoints)
    if (stop.value.trim()) lines.push(line("BY WAY OF", stop.value.trim()));
  for (const steward of v.stewards)
    if (steward.who.trim() || steward.handle.trim())
      lines.push(line("ASK", [steward.who.trim(), steward.handle.trim() && `@${steward.handle.trim()}`].filter(Boolean).join(" ")));
  const notice = v.notices.map((entry) => entry.value.trim()).filter(Boolean);
  if (notice.length) lines.push("", ...notice);
  if (v.orders.trim()) lines.push("", v.orders.trim());
  return lines.join("\n");
}

/** The row the board keeps — the same posting, as the clerk files it. */
export function toRecord(v: FormValues): string {
  const node: Record<string, unknown> = {};
  if (v.title.trim()) node["writ:title"] = v.title.trim();
  const notice = v.notices.map((entry) => entry.value.trim()).filter(Boolean);
  if (notice.length) node["writ:notice"] = notice;
  const tags = v.tags.map((entry) => entry.value.trim()).filter(Boolean);
  if (tags.length) node["writ:tag"] = tags;
  const beasts = v.beasts.filter((entry) => entry.value).map((entry) => entry.value);
  if (beasts.length) node["writ:beast"] = beasts;
  if (v.region) node["writ:region"] = v.region;
  if (v.grade) node["writ:grade"] = Number(v.grade);
  if (v.posted) node["writ:posted"] = v.posted;
  if (v.due) node["writ:due"] = v.due;
  if (v.poster?.hall)
    node["writ:poster"] = {
      hall: v.poster.hall,
      ...(v.poster.handle.trim() ? { signs: v.poster.handle.trim() } : {}),
      ...(v.poster.muster.trim() ? { muster: v.poster.muster.trim() } : {}),
    };
  const stewards = v.stewards
    .filter((steward) => steward.who.trim() || steward.handle.trim())
    .map((steward) => ({ who: steward.who.trim(), handle: steward.handle.trim() }));
  if (stewards.length) node["writ:ask"] = stewards;
  const invited = v.invited.filter((entry) => entry.value).map((entry) => entry.value);
  if (invited.length) node["writ:invited"] = invited;
  if (v.orders.trim()) node["writ:orders"] = v.orders.trim();
  if (v.reward.trim()) node["writ:reward"] = Number(v.reward.trim());
  const waypoints = v.waypoints.map((entry) => entry.value.trim()).filter(Boolean);
  if (waypoints.length) node["writ:waypoint"] = waypoints;
  const party = v.party
    .filter((row) => row.member)
    .map((row) => ({
      member: row.member,
      ...(row.duty ? { duty: row.duty } : {}),
      ...(row.terms.trim() ? { terms: row.terms.trim() } : {}),
    }));
  if (party.length) node["writ:party"] = party;
  return JSON.stringify(node, null, 2);
}

/** How many lines the writ carries — the number on the `Output` toggle. */
export function writLines(v: FormValues): number {
  return toWrit(v).split("\n").filter((entry) => entry.trim().length > 0).length;
}

// ── Faked AI streams (✨ Suggest `suggest` + Complete `complete`) ────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Eight of the board's own tags, with the reason a clerk would give.
 *
 * Keyed by `Tag`, so a tag that leaves the world's vocabulary fails the build here rather than
 * offering a suggestion the board would refuse.
 */
const TAG_NOTES: Partial<Record<Tag, string>> = {
  "night-work": "Most of these things are reported after dark",
  "bring-rope": "Roof work, and nobody carries enough",
  warding: "A ward left unlit is how the last one started",
  bounty: "Paid on the head, not on the day",
  escort: "Somebody has to walk with them",
  "standing-water": "Changes what boots the party needs",
  "second-attempt": "The board should know it failed once",
  "hall-honours": "Settles between halls rather than in gold",
};

const TAG_POOL: Suggestion[] = Object.entries(TAG_NOTES).map(([value, rationale]) => ({
  value,
  rationale,
}));

/** `useSuggestions`' `suggest` — streams candidate tags one at a time. */
export async function* suggestTags(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const s of TAG_POOL) {
    await sleep(180);
    if (signal?.aborted) return;
    yield s;
  }
}

/** The `Input` `complete` source — a canned single-line continuation for the title. */
export async function* completeTitle(
  value: string,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const continuation = ", and it is not rats";
  const words = continuation.split(/(?<=\s)/);
  for (const w of words) {
    await sleep(60);
    if (signal?.aborted) return;
    yield w;
  }
}

/** The `Textarea` `complete` source — streams a canned continuation for the notice. */
export async function* completeDescription(
  value: string,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const continuation =
    " Two nights' work at most. The hall pays for rope and lamp-oil, the ferryman has been told to expect a party, and anyone who sees it first walks back and says so.";
  const words = continuation.split(/(?<=\s)/);
  for (const w of words) {
    await sleep(45);
    if (signal?.aborted) return;
    yield w;
  }
}
