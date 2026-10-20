// LDBC SNB's graph for the answer tests, as `readJoinGraph` reads it from the graph fossil wrote
// (`@kanzo-tech/fixtures`' SNB sample: twelve people who know one another, with what they wrote early
// on, attached on DuckDB-WASM) — every column described, and what its writer counted. Not part of
// the published build (`vite.config.ts` excludes `src/testing`).

import { attachFixture, queryable } from "@kanzo-tech/fixtures";
import { readJoinGraph, type JoinGraph, type Relation } from "@kanzo-tech/relations";

export const SNB: JoinGraph = await (async () => {
  const engine = queryable();
  const { catalog } = await attachFixture("snb", engine);
  return readJoinGraph(engine, catalog, { signal: new AbortController().signal });
})();

/** A person, as the answer tests ask of them. */
export const PERSON: Relation = { root: "Person", path: [] };
/** Whom a person knows: back along the knowing they made, and on to the one it names. */
export const KNOWS: Relation = {
  root: "Person",
  path: [
    { edge: "Knowing_knower_Person", direction: "in" },
    { edge: "Knowing_known_Person", direction: "out" },
  ],
};
/** A post, and the person who wrote it. */
export const WROTE: Relation = { root: "Post", path: [{ edge: "Post_hasCreator_Person", direction: "out" }] };

/** The first `n` of `type`'s global ids, in the writer's order: what a lasso over them selects. */
export function idsOf(type: string, n: number): number[] {
  const first = SNB.types.find((t) => t.name === type)?.first;
  if (first === undefined) throw new Error(`SNB has no ${type} numbered by its writer`);
  return Array.from({ length: n }, (_, i) => first + i);
}
