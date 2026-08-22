import type { InlineCompletionRequest } from "@kanzo-tech/ai";
// The archive this panel answers over, and the five answers it knows.
//
// The split is the same one the workspace's Ask panel makes: the **language** is canned, the
// **answer** is not. A question resolves to a recipe, the recipe carries a SQL statement and a
// function that computes exactly what that statement says over `@/example` — so the table under
// the answer is a real result set, and the prose quotes numbers it did not choose.

import { QUESTS, board, daysOverdue, dueOn, hallOf, overdueQuests, type Quest } from "@/example/quests";
import { ROSTER } from "@/example/roster";
import { beast, hall, role, type BeastId, type HallId } from "@/example/world";

export type Phase = "generating" | "executing" | "explaining" | "done";

/** A column of a result set. `numeric` is alignment, not a type. */
export interface ResultColumn {
  key: string;
  header: string;
  numeric?: boolean;
}

export type ResultRow = Record<string, string | number>;

export interface Recipe {
  id: string;
  question: string;
  /** Words that select this recipe when the reader types their own phrasing. */
  match: string[];
  /** The relation the agent picked, shown as the tool's argument. */
  relation: string;
  reasoning: string;
  sql: string;
  columns: ResultColumn[];
  run: () => ResultRow[];
  explain: (rows: ResultRow[]) => string;
  /** Set when the schema cannot answer it at all: the tool fails and says why. */
  failure?: string;
}

/** What the rail lists — the shape a text-to-SQL agent is given before it writes anything. */
export interface Relation {
  name: string;
  note: string;
  columns: string[];
  rows: number;
}

export const RELATIONS: Relation[] = [
  {
    name: "contracts",
    note: "The board: everything posted, claimed, walked or lost.",
    columns: [
      "id text",
      "title text",
      "hall text",
      "region text",
      "beast text",
      "grade int",
      "status text",
      "reward int",
      "due_day_offset int",
      "sightings int",
    ],
    rows: QUESTS.length,
  },
  {
    name: "roster",
    note: "Every member of every hall, with what the board implies about them today.",
    columns: [
      "id text",
      "name text",
      "hall text",
      "role text",
      "rank text",
      "availability text",
      "fee int",
      "settled int",
    ],
    rows: ROSTER.length,
  },
];

const gold = new Intl.NumberFormat("en-US");

const byNumber = (key: string) => (a: ResultRow, b: ResultRow) =>
  Number(b[key]) - Number(a[key]);

function sumBy<K extends string>(rows: readonly Quest[], key: (row: Quest) => K) {
  const totals = new Map<K, Quest[]>();
  for (const row of rows) {
    const bucket = key(row);
    totals.set(bucket, [...(totals.get(bucket) ?? []), row]);
  }
  return totals;
}

export const RECIPES: Recipe[] = [
  {
    id: "overdue",
    question: "Which contracts are overdue, and by how much?",
    match: ["overdue", "late", "past due", "did not come back", "still out"],
    relation: "contracts",
    reasoning:
      "Overdue is two conditions, not one: a contract is out (`status = 'afield'`) AND its due " +
      "date has passed. A settled contract that was late is no longer overdue, so the status " +
      "filter has to be there.",
    sql: `SELECT id, title, hall, region, due, -due_day_offset AS days_late
FROM contracts
WHERE status = 'afield' AND due_day_offset < 0
ORDER BY days_late DESC;`,
    columns: [
      { key: "id", header: "Contract" },
      { key: "title", header: "Title" },
      { key: "hall", header: "Hall" },
      { key: "region", header: "Region" },
      { key: "due", header: "Due" },
      { key: "days_late", header: "Days late", numeric: true },
    ],
    run: () =>
      overdueQuests()
        .map((contract) => ({
          id: contract.id,
          title: contract.title,
          hall: hallOf(contract).short,
          region: contract.region,
          due: dueOn(contract),
          days_late: daysOverdue(contract),
        }))
        .sort(byNumber("days_late")),
    explain: (rows) => {
      const worst = rows[0];
      if (!worst) return "Nothing on the board is past its date.";
      return `${rows.length} parties are out past the date they were due back. The longest is ${worst.id} — ${worst.title} — ${worst.days_late} days late in ${worst.region}, signed for by ${worst.hall}. Every one of them is still \`afield\`, so none has been written off yet.`;
    },
  },
  {
    id: "halls",
    question: "What is each hall carrying on the board?",
    match: ["hall", "carrying", "worth", "value", "gold", "who posted"],
    relation: "contracts",
    reasoning:
      "Two aggregates over one grouping. `open` is a filtered count rather than a second query, " +
      "because a hall with a lot of gold and nothing open is a different story from one with both.",
    sql: `SELECT hall,
       count(*)                                    AS contracts,
       count(*) FILTER (WHERE status = 'open')     AS open,
       sum(reward)                                 AS gold
FROM contracts
GROUP BY hall
ORDER BY gold DESC;`,
    columns: [
      { key: "hall", header: "Hall" },
      { key: "contracts", header: "Contracts", numeric: true },
      { key: "open", header: "Open", numeric: true },
      { key: "gold", header: "Gold", numeric: true },
    ],
    run: () =>
      [...sumBy(board(), (contract) => contract.hall as HallId)]
        .map(([id, rows]) => ({
          hall: hall(id).short,
          contracts: rows.length,
          open: rows.filter((contract) => contract.status === "open").length,
          gold: rows.reduce((total, contract) => total + contract.reward, 0),
        }))
        .sort(byNumber("gold")),
    explain: (rows) => {
      const top = rows[0];
      const total = rows.reduce((sum, row) => sum + Number(row.gold), 0);
      if (!top) return "No hall has posted anything.";
      return `The board is carrying ${gold.format(total)} gold across ${rows.length} halls. ${top.hall} holds the largest share at ${gold.format(Number(top.gold))} over ${top.contracts} contracts, ${top.open} of them still unclaimed.`;
    },
  },
  {
    id: "ready",
    question: "Who can be sent out today?",
    match: ["ready", "available", "send", "free", "who can go", "roster"],
    relation: "roster",
    reasoning:
      "Availability is derived, not stored: a member is `ready` when no live contract holds them " +
      "and nothing has happened to them. Ordering by fee puts the expensive people first, which " +
      "is what a quartermaster is actually deciding about.",
    sql: `SELECT name, hall, role, rank, fee
FROM roster
WHERE availability = 'ready'
ORDER BY fee DESC, name;`,
    columns: [
      { key: "name", header: "Member" },
      { key: "hall", header: "Hall" },
      { key: "role", header: "Role" },
      { key: "rank", header: "Rank" },
      { key: "fee", header: "Fee", numeric: true },
    ],
    run: () =>
      ROSTER.filter((entry) => entry.availability === "ready")
        .map((entry) => ({
          name: entry.name,
          hall: hall(entry.hall).short,
          role: role(entry.role).label,
          rank: entry.rank,
          fee: entry.fee,
        }))
        .sort((a, b) => b.fee - a.fee || a.name.localeCompare(b.name)),
    explain: (rows) => {
      const dearest = rows[0];
      if (!dearest) return "Every hall has its whole roster committed.";
      return `${rows.length} members are unclaimed and unhurt today. ${dearest.name} is the dearest of them at ${dearest.fee} gold a day — a ${String(dearest.role).toLowerCase()} of ${dearest.hall}. Anyone missing from this list is either afield, resting or worse.`;
    },
  },
  {
    id: "beasts",
    question: "Which beasts account for the most sightings?",
    match: ["beast", "sighting", "monster", "encounter", "most seen"],
    relation: "contracts",
    reasoning:
      "Sightings are a column on the contract, not a relation of their own, so this is one sum " +
      "over a grouping. Contracts with no beast — escorts, surveys, ledger work — drop out on the " +
      "`IS NOT NULL`, which is why the counts do not add up to the whole board.",
    sql: `SELECT beast, count(*) AS contracts, sum(sightings) AS sightings
FROM contracts
WHERE beast IS NOT NULL
GROUP BY beast
ORDER BY sightings DESC;`,
    columns: [
      { key: "beast", header: "Beast" },
      { key: "contracts", header: "Contracts", numeric: true },
      { key: "sightings", header: "Sightings", numeric: true },
    ],
    run: () =>
      [...sumBy(board().filter((contract) => contract.beast), (contract) => contract.beast as BeastId)]
        .map(([id, rows]) => ({
          beast: beast(id).label,
          contracts: rows.length,
          sightings: rows.reduce((total, contract) => total + contract.sightings, 0),
        }))
        .sort(byNumber("sightings")),
    explain: (rows) => {
      const top = rows[0];
      if (!top) return "Nothing has been reported.";
      const total = rows.reduce((sum, row) => sum + Number(row.sightings), 0);
      return `${gold.format(total)} encounters were reported across ${rows.length} classified beasts. ${top.beast} leads with ${top.sightings} of them over ${top.contracts} contracts. Escort, survey and ledger work carries no beast at all and is not counted here.`;
    },
  },
  {
    id: "payments",
    question: "What was each member paid last winter?",
    match: ["paid", "payment", "wage", "salary", "invoice", "winter"],
    relation: "roster",
    reasoning:
      "`roster.fee` is a day-rate and `contracts.reward` is what a contract is worth to the hall. " +
      "Neither is a payment, and no relation records one — so there is nothing to select and " +
      "guessing a join would produce a confident wrong number.",
    sql: `SELECT name, sum(payment) AS paid
FROM roster JOIN payments USING (id)
WHERE season = 'winter'
GROUP BY name;`,
    columns: [],
    run: () => [],
    explain: () => "",
    failure:
      "No such relation: payments. The archive records a member's day-fee and a contract's reward, and never what changed hands.",
  },
];

/**
 * The recipe's own question wins before any keyword does — a suggestion the panel just offered
 * must resolve to the recipe that produced it, and none of them contains its own keywords.
 */
export function recipeFor(question: string): Recipe | null {
  const asked = question.trim().toLowerCase();
  const offered = RECIPES.find((recipe) => recipe.question.toLowerCase() === asked);
  if (offered) return offered;
  return RECIPES.find((recipe) => recipe.match.some((word) => asked.includes(word))) ?? null;
}

export type AskEvent =
  | { kind: "phase"; phase: Phase }
  | { kind: "reasoning"; text: string }
  | { kind: "plan"; recipe: Recipe }
  | { kind: "explain"; text: string }
  | { kind: "failed"; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Word-at-a-time, the way a token stream arrives. The lookbehind keeps the spaces. */
const chunks = (text: string) => text.split(/(?<=\s)/);

const NOTHING =
  "That is outside what this fake agent knows. The ✨ button lists the questions it can answer.";

/**
 * The model, faked: phases, a reasoning stream, a plan, then an explanation stream.
 *
 * It is an async generator taking an `AbortSignal`, which is exactly the shape a real endpoint
 * has — so the swap is this function and nothing else.
 */
export async function* askStream(question: string, signal?: AbortSignal): AsyncIterable<AskEvent> {
  yield { kind: "phase", phase: "generating" };
  const recipe = recipeFor(question);

  if (!recipe) {
    await wait(300);
    if (signal?.aborted) return;
    yield { kind: "failed", message: NOTHING };
    yield { kind: "phase", phase: "done" };
    return;
  }

  for (const chunk of chunks(recipe.reasoning)) {
    await wait(18);
    if (signal?.aborted) return;
    yield { kind: "reasoning", text: chunk };
  }

  await wait(200);
  if (signal?.aborted) return;
  yield { kind: "plan", recipe };
  yield { kind: "phase", phase: "executing" };

  await wait(420);
  if (signal?.aborted) return;

  if (recipe.failure) {
    yield { kind: "failed", message: recipe.failure };
    yield { kind: "phase", phase: "done" };
    return;
  }

  yield { kind: "phase", phase: "explaining" };
  for (const chunk of chunks(recipe.explain(recipe.run()))) {
    await wait(22);
    if (signal?.aborted) return;
    yield { kind: "explain", text: chunk };
  }

  yield { kind: "phase", phase: "done" };
}

/** Candidate questions, streamed the way a model would hand them over. */
export async function* askSuggestions(signal?: AbortSignal): AsyncIterable<{
  value: string;
  rationale?: string;
}> {
  for (const recipe of RECIPES) {
    await wait(160);
    if (signal?.aborted) return;
    yield { value: recipe.question, rationale: `One statement over \`${recipe.relation}\`.` };
  }
}

/** The ghost continuation. Canned, and only ever offered for a prefix it recognises. */
export async function* completeQuestion({ value, position, signal }: InlineCompletionRequest) {
  // What is being continued is what comes BEFORE the caret, not the whole value.
  const typed = value.slice(0, position).trim().toLowerCase();
  if (typed.length < 3) return;
  const hit = RECIPES.find((recipe) => recipe.question.toLowerCase().startsWith(typed));
  if (!hit) return;
  for (const chunk of chunks(hit.question.slice(position))) {
    await wait(40);
    if (signal?.aborted) return;
    yield chunk;
  }
}
