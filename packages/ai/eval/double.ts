import type { ModelScript } from "@kanzo-tech/testing";
import type { AskSpec } from "../src/data/ask.js";

/**
 * **The smoke run's model** — `EVAL_DOUBLE=1`: `@kanzo-tech/llm/testing`'s double, answering a few
 * cases' questions with the spec a right answer is, so the runner, the page and the scoring are seen
 * to work on a machine with no GPU. It scores nothing: the set measures the model, and this is not
 * one. Only the cases it answers run.
 */

const answers: Record<string, AskSpec> = {
  "How many Nobel prizes have been awarded?": { of: "LaureateAward", show: { kind: "stat", measure: { op: "count" } } },
  "Which universities won the most prizes?": {
    of: "LaureateAward",
    show: { kind: "chart", type: "bar", x: "university.name", y: { op: "count" } },
  },
  "Which ones were won in Germany?": {
    of: "LaureateAward",
    where: [{ field: "university.addressCountry.name", in: ["Germany"] }],
    show: { kind: "chart", type: "bar", x: "university.name", y: { op: "count" } },
  },
  "Which countries have won the most prizes?": {
    of: "LaureateAward",
    show: { kind: "chart", type: "bar", x: "laureate.birthPlace.name", y: { op: "count" } },
  },
  "How many people are women, and how many are men?": {
    of: "Person",
    show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } },
  },
};

/** The questions the double answers: a case runs under it only when it asks nothing else. */
export const ANSWERED = new Set(Object.keys(answers));

export const DOUBLE: ModelScript = {
  turns: Object.entries(answers).map(([question, spec]) => ({ when: `Question: ${question}`, reply: { object: { spec } } })),
};
