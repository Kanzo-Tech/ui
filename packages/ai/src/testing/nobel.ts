// The Nobel example's graph for the Ask tests, as keasy's Discover reads it from a corpus, and the
// model double answering with specs. Not part of the published build (`vite.config.ts` excludes `src/testing`).

import type { JoinGraph } from "@kanzo-tech/mosaic";
import { asTableRef } from "@uwdata/mosaic-sql";
import { scriptedModel } from "@kanzo-tech/llm/testing";
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
  types: Object.entries({ LaureateAward: ["share"], Laureate: ["name", "gender"], Category: ["name"], University: ["name"], Country: ["name"] }).map(
    ([name, columns]) => ({ name, table: at(name), key: "id", columns }),
  ),
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
  alone("LaureateAward", [field("share", "numeric")]),
  alone("Laureate", [field("name", "categorical"), field("gender", "categorical", ["male", "female"])]),
  alone("Category", [field("name", "categorical", ["Physics", "Chemistry"])]),
  alone("University", [field("name", "categorical")]),
  alone("Country", [field("name", "categorical", ["USA", "Germany"])]),
];

/** The one model double, answering each call with the next of `values` and the last one after that. */
export const answering = (...values: unknown[]) =>
  scriptedModel({ turns: values.map((object, i) => ({ once: i < values.length - 1, reply: { object } })) });
