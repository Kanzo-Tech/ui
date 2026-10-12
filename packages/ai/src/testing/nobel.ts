// The Nobel example's graph for the Ask tests, as keasy's Discover reads it from a corpus, and a model
// that answers with specs. Not part of the published build (`vite.config.ts` excludes `src/testing`).

import type { JoinGraph } from "@kanzo-tech/mosaic";
import { asTableRef } from "@uwdata/mosaic-sql";
import { MockLanguageModelV4 } from "ai/test";
import type { AnswerField, AnswerRelation } from "../data/answer.js";

const at = (table: string) => asTableRef(["jobs/7", table])!;
const edge = (source: string, label: string, destination: string) => ({
  name: `${source}_${label}_${destination}`,
  label,
  source,
  destination,
  table: at(`${source}_${label}_${destination}`),
  src: "src",
  dst: "dst",
});

export const NOBEL: JoinGraph = {
  types: ["LaureateAward", "Laureate", "Category", "University", "Country"].map((name) => ({ name, table: at(name), key: "id", columns: ["name"] })),
  edges: [
    edge("LaureateAward", "laureate", "Laureate"),
    edge("LaureateAward", "category", "Category"),
    edge("LaureateAward", "university", "University"),
    edge("Laureate", "birthPlace", "Country"),
    edge("University", "addressCountry", "Country"),
  ],
};

const field = (name: string, kind: AnswerField["kind"], values?: string[]): AnswerField => ({
  name,
  type: kind === "numeric" ? "BIGINT" : "VARCHAR",
  kind,
  role: kind === "numeric" ? "measure" : "dimension",
  distinct: 10,
  ...(values ? { values } : {}),
});

const alone = (root: string, fields: AnswerField[]): AnswerRelation => ({ relation: { root, path: [] }, fields, columns: ["id", ...fields.map((f) => f.name)] });

export const TYPES: AnswerRelation[] = [
  alone("LaureateAward", [field("LaureateAward.share", "numeric")]),
  alone("Laureate", [field("Laureate.name", "categorical"), field("Laureate.gender", "categorical", ["male", "female"])]),
  alone("Category", [field("Category.name", "categorical", ["Physics", "Chemistry"])]),
  alone("University", [field("University.name", "categorical")]),
  alone("Country", [field("Country.name", "categorical", ["USA", "Germany"])]),
];

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };

/** A model that answers each call with the next of `values`, as JSON, and the last one after that. */
export const answering = (...values: unknown[]) => {
  let n = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(values[Math.min(n++, values.length - 1)]) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
};
