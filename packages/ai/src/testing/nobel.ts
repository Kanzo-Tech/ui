// The Nobel example's graph for the Ask tests, as `attachGraph` attaches the graph fossil wrote
// (`@kanzo-tech/fixtures`' Nobel sample, prizes of 2000 to 2004, on DuckDB-WASM), and the engine it is
// read on — and the model double answering with specs. Not part of the published build
// (`vite.config.ts` excludes `src/testing`).

import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { attachFixture, queryable } from "@kanzo-tech/fixtures";
import { scriptedModel } from "@kanzo-tech/llm/testing";

/** The engine the Nobel graph is attached on. */
export const NOBEL_ENGINE = queryable();
export const NOBEL: Graph = await attachFixture("nobel", NOBEL_ENGINE);

/** The one model double, answering each call with the next of `values` and the last one after that. */
export const answering = (...values: unknown[]) =>
  scriptedModel({ turns: values.map((object, i) => ({ once: i < values.length - 1, reply: { object } })) });

/** `answering` as Ask is answered: each spec is the `spec` of the object its schema's root is. */
export const asking = (...specs: unknown[]) => answering(...specs.map((spec) => ({ spec })));
