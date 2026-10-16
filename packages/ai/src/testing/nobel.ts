// The Nobel example's graph for the Ask tests, as `readJoinGraph` reads it from an attached graph — every
// column described, and what its writer counted — and the
// model double answering with specs. Not part of the published build (`vite.config.ts` excludes `src/testing`).

import type { JoinColumn, JoinGraph } from "@kanzo-tech/relations";
import { asTableRef } from "@uwdata/mosaic-sql";
import { scriptedModel } from "@kanzo-tech/llm/testing";

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

/** A column as the graph describes it: a number or a text, and what its writer counted — its commonest values among them. */
const column = (name: string, kind: "numeric" | "categorical", values: string[] = []): JoinColumn => ({
  name,
  type: kind === "numeric" ? "BIGINT" : "VARCHAR",
  stats: { nullCount: 0, distinctCount: 10, mostCommonVals: values, mostCommonFreqs: values.map(() => 1 / 10) },
});
const type = (name: string, columns: JoinColumn[]) => ({
  name,
  table: at(name),
  key: "id",
  columns: [{ name: "id", type: "BIGINT", role: "address" }, ...columns],
});

export const NOBEL: JoinGraph = {
  types: [
    type("LaureateAward", [column("share", "numeric")]),
    type("Laureate", [column("name", "categorical"), column("gender", "categorical", ["male", "female"])]),
    type("Category", [column("name", "categorical", ["Physics", "Chemistry"])]),
    type("University", [column("name", "categorical")]),
    type("Country", [column("name", "categorical", ["USA", "Germany"])]),
  ],
  edges: [
    edge("LaureateAward", "laureate", "Laureate"),
    edge("LaureateAward", "category", "Category"),
    edge("LaureateAward", "university", "University"),
    edge("Laureate", "birthPlace", "Country"),
    edge("University", "addressCountry", "Country"),
  ],
};

/** The one model double, answering each call with the next of `values` and the last one after that. */
export const answering = (...values: unknown[]) =>
  scriptedModel({ turns: values.map((object, i) => ({ once: i < values.length - 1, reply: { object } })) });

/** `answering` as Ask is answered: each spec is the `spec` of the object its schema's root is. */
export const asking = (...specs: unknown[]) => answering(...specs.map((spec) => ({ spec })));
