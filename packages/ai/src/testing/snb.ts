// LDBC SNB's graph for the answer tests, as `attachGraph` attaches the graph fossil wrote
// (`@kanzo-tech/fixtures`' SNB sample: twelve people who know one another, with what they wrote early
// on, on DuckDB-WASM), and the engine it is read on. Not part of the published build
// (`vite.config.ts` excludes `src/testing`).

import type { Graph, Pattern } from "@kanzo-tech/graphar-duckdb";
import { attachFixture, queryable } from "@kanzo-tech/fixtures";

/** The engine the SNB graph is attached on. */
export const SNB_ENGINE = queryable();
export const SNB: Graph = await attachFixture("snb", SNB_ENGINE);

/** A person, as the answer tests ask of them. */
export const PERSON: Pattern = [{ as: "person", type: "Person" }];
/** Whom a person knows: back along the knowing they made, and on to the one it names. */
export const KNOWS: Pattern = [
  { as: "person", type: "Person" },
  { edge: "knower", direction: "in" },
  { as: "knowing", type: "Knowing" },
  { edge: "known", direction: "out" },
  { as: "known", type: "Person" },
];
/** A post, and the person who wrote it. */
export const WROTE: Pattern = [{ as: "post", type: "Post" }, { edge: "hasCreator", direction: "out" }, { as: "person", type: "Person" }];
