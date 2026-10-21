import type { Pattern } from "@kanzo-tech/graphar-duckdb";

/**
 * **Ask's evaluation set** — Kanzo Tasks (`/docs/design/tasks#the-evaluation-set`). Written by hand
 * and never trained on: a case is what a reader asks and what the data says the answer is, so the
 * same set scores today's Ask, a Task, and every model either is run with. It came from keasy's
 * `e2e/eval` (`/docs/design/testing`, *Ask's evaluation set lives beside Ask*), and it is data apart
 * from its runner, `ask.eval.ts`, so a second runner reads the same cases.
 *
 * Every figure is the corpus's own, computed with DuckDB over `fixtures/graphs/<name>/data` — the query
 * beside each where it is not plain from the question. Ask's cases are by shape of question, not by
 * count: Nobel for nearly every shape, LDBC SNB for what Nobel lacks — self-joins and a large graph.
 * The set grows with readers' failures.
 *
 * A case is scored by **execution accuracy**: the rows the answer was read from (its card's data
 * table, the engine's) hold every `holds` pair and no `lacks` pair. A pair is a label and a count; a
 * label of `null` is a figure, any cell. One shape has no rows to score: a question the data cannot
 * answer, which must draw no card (`expects: "refusal"`). A question two patterns of one length answer
 * — a prize's country, by its laureate's birth or its university's address — is answered by the
 * pattern the model wrote, so it is scored as an answer whichever it wrote: its `holds` is empty.
 */

/** A row the answer must, or must not, have been read from: a label and its count. */
export type Pair = readonly [label: string | null, n: number];

/** The page the question is asked on: a dashboard's pattern, and a bar picked on its one tile — its `x` a field of the pattern. */
export interface Page {
  /** The pattern the dashboard is over, its first vertex what it counts. */
  readonly pattern: Pattern;
  /** The page's filter, if any: one tile counting `x`, and the bar `pick` picked on it. */
  readonly filter?: { readonly x: string; readonly pick: string };
}

export interface AskCase {
  readonly id: string;
  /** The corpus asked: `fixtures/graphs/<name>`, written to the docs' `public/corpus/<name>` by `corpus.mjs`. */
  readonly corpus: string;
  readonly page: Page;
  /** The questions, asked in turn in one conversation; the last one is scored. */
  readonly ask: readonly string[];
  /** What the last question must end in: rows (the default), or no answer. */
  readonly expects?: "rows" | "refusal";
  readonly holds: readonly Pair[];
  readonly lacks?: readonly Pair[];
  /** Why the case is in the set: the failure it is the test for. */
  readonly tests: string;
}

const PRIZES_BY_CATEGORY: Page = {
  pattern: [{ as: "award", type: "LaureateAward" }, { edge: "category", direction: "out" }, { as: "category", type: "Category" }],
};
const PHYSICS: Page = { ...PRIZES_BY_CATEGORY, filter: { x: "category.name", pick: "Physics" } };

export const ASK: readonly AskCase[] = [
  // The two questions keasy's Nobel demo asks.
  {
    id: "nobel-universities-in-view",
    corpus: "nobel",
    page: PHYSICS,
    ask: ["Which universities won the most prizes?"],
    // Physics prizes by institution; 43 is UC's in every category — an answer that dropped the filter.
    holds: [["University of California", 16], ["Princeton University", 10]],
    lacks: [["University of California", 43]],
    tests: "a hop the page's filter reaches, and the filter kept",
  },
  {
    id: "nobel-follow-up-germany",
    corpus: "nobel",
    page: PHYSICS,
    ask: ["Which universities won the most prizes?", "Which ones were won in Germany?"],
    // `… and i.country = 'germany'`: every German institution has 2 Physics prizes or fewer.
    holds: [["University of Heidelberg", 2]],
    lacks: [["University of California", 16], ["Princeton University", 10]],
    tests: "a follow-up is the previous answer with one more where",
  },
  {
    id: "nobel-prizes-by-category",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many prizes were awarded in each category?"],
    // select category, count(*) from awards group by 1
    holds: [["Physics", 230], ["Chemistry", 200], ["Peace", 143]],
    tests: "the relation on screen, no filter",
  },
  {
    id: "nobel-laureates-twice",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["Which laureates won more than one prize?"],
    // select l.name, count(*) from awards a join laureates l on l.id = a.laureate group by 1 having count(*) > 1
    holds: [["Marie Curie", 2], ["Linus Pauling", 2]],
    tests: "a hop from the relation on screen to another type, ranked",
  },
  {
    id: "nobel-women",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many laureates are women?"],
    // select count(*) from laureates where gender = 'female'
    holds: [[null, 67]],
    tests: "a figure over another type than the one on screen, with a where",
  },
  {
    id: "nobel-birth-countries",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["In which countries were the most laureates born?"],
    // select co.name, count(*) from laureates l join countries co on co.id = l.country group by 1
    holds: [["USA", 296], ["Germany", 84]],
    tests: "a two-type hop the screen does not show",
  },
  {
    id: "nobel-prizes",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many Nobel prizes have been awarded?"],
    // select count(*) from awards
    holds: [[null, 1026]],
    tests: "a figure over the relation's root, no where",
  },
  {
    id: "nobel-women-by-category",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["In which categories have women won the most prizes?"],
    // … join laureates l … where l.gender = 'female' group by category
    holds: [["Peace", 20], ["Literature", 18], ["Physiology or Medicine", 14]],
    tests: "a breakdown over one hop with a where over another",
  },
  {
    id: "nobel-prizes-to-women",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many prizes went to women?"],
    // 68 prizes to 67 women: Marie Curie won two. 67 is the laureates, the wrong thing counted.
    holds: [[null, 68]],
    lacks: [[null, 67]],
    tests: "what is counted: prizes, not the laureates who won them",
  },
  {
    id: "nobel-2000s",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many prizes were awarded between 2000 and 2009?"],
    // select count(*) from awards where year between 2000 and 2009
    holds: [[null, 123]],
    tests: "a date range on a year",
  },
  {
    id: "nobel-since-2000-by-category",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["Since 2000, how many prizes has each category awarded?"],
    holds: [["Physics", 71], ["Chemistry", 68], ["Literature", 26]],
    tests: "an open-ended date range and a breakdown at once",
  },
  {
    id: "nobel-peace-1990s",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many Peace prizes were awarded in the 1990s?"],
    holds: [[null, 17]],
    tests: "a category and a decade, both written in words",
  },
  {
    id: "nobel-physics-by-gender",
    corpus: "nobel",
    page: PHYSICS,
    ask: ["How do these prizes split between men and women?"],
    // "these" is the page: the Physics prizes, 225 to men and 5 to women.
    holds: [["male", 225], ["female", 5]],
    tests: "a breakdown over a hop, under the page's filter, named only as «these»",
  },
  {
    id: "nobel-german-born-by-category",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["Laureates born in Germany: which categories did they win in?"],
    // awards ⋈ laureates ⋈ countries where country = 'Germany', by category: two hops apart
    holds: [["Physics", 27], ["Chemistry", 26], ["Physiology or Medicine", 18]],
    tests: "two hops from the counted type, one carrying the where and one the breakdown",
  },
  {
    id: "nobel-universities-by-country",
    corpus: "nobel",
    page: { pattern: [{ as: "university", type: "University" }] },
    ask: ["Which countries have the most universities?"],
    // select co.name, count(*) from institutions i join countries co … group by 1
    holds: [["USA", 147], ["Germany", 55], ["United Kingdom", 42]],
    tests: "a hop from a type that is not the one the page usually shows",
  },
  {
    id: "nobel-paris-universities",
    corpus: "nobel",
    page: { pattern: [{ as: "university", type: "University" }] },
    ask: ["How many of the universities are in Paris?"],
    holds: [[null, 15]],
    tests: "a where on a type's own field, a figure",
  },
  {
    id: "nobel-born-in-poland",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many laureates were born in Poland?"],
    // Within today's borders, as the API places a birth: Marie Curie and 27 others.
    holds: [[null, 28]],
    tests: "a where across a hop, counting the type at its start",
  },
  {
    id: "nobel-women-born-since-1950",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many women laureates were born in 1950 or later?"],
    holds: [[null, 23]],
    tests: "a category where and a date where on one type",
  },
  {
    id: "nobel-shared-physics",
    corpus: "nobel",
    page: PHYSICS,
    ask: ["How are these prizes shared — alone, in halves, thirds or quarters?"],
    // share is the denominator: 47 alone, 86 halves, 57 thirds, 40 quarters
    holds: [["1", 47], ["2", 86], ["4", 40]],
    tests: "a breakdown by a numeric field the reader names in words",
  },
  {
    id: "nobel-chemistry-universities",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["Which universities have the most Chemistry prizes?"],
    holds: [["University of California", 15], ["Harvard University", 6]],
    tests: "a ranking over a hop, with a where over another hop of the same root",
  },
  {
    id: "nobel-motivation-peace",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many prizes mention peace in their motivation?"],
    // motivation ilike '%peace%'
    holds: [[null, 61]],
    tests: "a contains over free text",
  },
  {
    id: "nobel-synonym-female-winners",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How many female Nobel winners are there?"],
    // "female winners" is gender = 'female' over the laureates
    holds: [[null, 67]],
    tests: "a synonym: «female winners» for laureates whose gender is female",
  },
  {
    id: "nobel-countries-two-paths",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["Which countries have won the most prizes?"],
    // A prize reaches a country two equally short ways: its laureate's birth (USA 299) and its
    // university's country (USA 411). The model's pattern is the answer.
    holds: [],
    tests: "two patterns of one length: answered by the one the model wrote, asking nothing",
  },
  {
    id: "nobel-no-prize-money",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["How much prize money was awarded in 2020?"],
    expects: "refusal",
    // The data has no amount at all: any card is an answer to a different question.
    holds: [],
    tests: "a question the data has no field for",
  },
  {
    id: "nobel-no-age",
    corpus: "nobel",
    page: PRIZES_BY_CATEGORY,
    ask: ["What was the average age of laureates when they won?"],
    expects: "refusal",
    // An age is an expression over two fields of two types; the spec has no arithmetic.
    holds: [],
    tests: "a question the spec cannot say: arithmetic across two types",
  },
  // keasy's SNB demo.
  {
    id: "snb-gender",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many people are women, and how many are men?"],
    holds: [["female", 778], ["male", 750]],
    tests: "a breakdown by a category on a large graph's smallest type",
  },
  {
    id: "snb-women-born-1985-1989",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many women were born between 1985 and 1989?"],
    holds: [[null, 391]],
    tests: "two conditions at once, one of them a date range",
  },
  {
    id: "snb-browsers",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["Which browsers do people use most?"],
    holds: [["Firefox", 628], ["Chrome", 438], ["Internet Explorer", 364]],
    tests: "a ranking by a category on the type on screen",
  },
  {
    id: "snb-countries",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["Which countries do most people live in?"],
    // A person is located in a city, and a city is part of a country: Place twice, a self-join.
    holds: [["India", 222], ["China", 208], ["Germany", 55]],
    tests: "a self-join: the same type twice in one pattern",
  },
  {
    id: "snb-posts-by-women",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many posts were written by women?"],
    holds: [[null, 68294]],
    tests: "counting another type than the one on screen, across a hop, on a large table",
  },
  {
    id: "snb-post-browsers",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["Which browsers are posts written from?"],
    holds: [["Firefox", 53312], ["Internet Explorer", 36600], ["Chrome", 35050]],
    tests: "a breakdown over 135,701 rows",
  },
  {
    id: "snb-long-comments",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many comments are longer than 100 characters?"],
    // select count(*) from comment where length > 100
    holds: [[null, 7621]],
    tests: "a numeric range written as a comparison",
  },
  {
    id: "snb-longest-comment",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How long is the longest comment?"],
    // select max(length) from comment: a measure other than a count
    holds: [[null, 1988]],
    tests: "a maximum, not a count",
  },
  {
    id: "snb-friendships-2011",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many friendships were made in 2011?"],
    // A knowing is the relation as a vertex, with its date: 5,559 of 14,073 began in 2011.
    holds: [[null, 5559]],
    tests: "the relation as a vertex, with a date range on it",
  },
  {
    id: "snb-women-chrome",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["How many women use Chrome?"],
    holds: [[null, 224]],
    tests: "two category conditions at once",
  },
  {
    id: "snb-most-friends-two-paths",
    corpus: "snb",
    page: { pattern: [{ as: "person", type: "Person" }] },
    ask: ["Who has the most friends?"],
    // A knowing reaches a person as its knower and as its known — `knower` and `known` — two patterns
    // of one length; the model's is the answer.
    holds: [],
    tests: "two patterns of one length on a type that points at one type twice, asking nothing",
  },
];
