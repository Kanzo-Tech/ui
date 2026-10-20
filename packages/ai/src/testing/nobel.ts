// The Nobel example's graph for the Ask tests, as `readJoinGraph` reads it from the graph fossil wrote
// (`@kanzo-tech/fixtures`' Nobel sample, prizes of 2000 to 2004, attached on DuckDB-WASM) — every column
// described, and what its writer counted — and the model double answering with specs. Not part of the
// published build (`vite.config.ts` excludes `src/testing`).

import { attachFixture, queryable } from "@kanzo-tech/fixtures";
import { readJoinGraph, type JoinGraph } from "@kanzo-tech/relations";
import { scriptedModel } from "@kanzo-tech/llm/testing";

export const NOBEL: JoinGraph = await (async () => {
  const engine = queryable();
  const { catalog } = await attachFixture("nobel", engine);
  return readJoinGraph(engine, catalog, { signal: new AbortController().signal });
})();

/** The one model double, answering each call with the next of `values` and the last one after that. */
export const answering = (...values: unknown[]) =>
  scriptedModel({ turns: values.map((object, i) => ({ once: i < values.length - 1, reply: { object } })) });

/** `answering` as Ask is answered: each spec is the `spec` of the object its schema's root is. */
export const asking = (...specs: unknown[]) => answering(...specs.map((spec) => ({ spec })));
