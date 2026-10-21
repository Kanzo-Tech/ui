import type { Graph, Pattern } from "@kanzo-tech/graphar-duckdb";
import { clausePoints, crossfilterOver, onRelation, relationOver, verbatim, type Relation, type SelectionClause, Query } from "@kanzo-tech/mosaic";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { attach, type Attached } from "../../test/corpus";

/**
 * **The page's one selection across relations, as properties** — `/docs/design/crossfilter#one-selection-across-relations`.
 * Each run takes two random patterns over the corpus's graph (a vertex, or a path of up to two edges
 * from it), publishes a random clause on the first, and reads the second through the page's resolver
 * — against an oracle that is not the resolver: DuckDB asked for each pattern's rows on its own, and
 * the semi-join done here, by hand.
 *
 * - the clause on A reaches B exactly as the semi-join on A's first vertex into B's first vertex of
 *   its type — or, where B has none, into B's first vertex along the graph's one shortest path
 *   (`Graph.reach`), and as nothing where there is no such path;
 * - a chip's × (`selection.reset([clause])`) retracts it for every reader, whatever relation it was on.
 */

const SIZE = 20;
const RUNS = { numRuns: 30 };
/** A round of real DuckDB queries per run; the budget is the property's. */
const BUDGET = { timeout: 120_000 };

type Rows = Record<string, unknown>[];

async function rows(corpus: Attached, query: Query | string): Promise<Rows> {
  const answer = (await corpus.coordinator.query(query, { type: "json" })) as unknown as Rows;
  return [...answer];
}

/** A pattern drawn from `graph`: a vertex and up to two edges, the edges picked by `walk`, each vertex named by its place. */
function patternFrom(graph: Graph, root: number, walk: readonly number[]): Pattern {
  const types = graph.vertexTypes.map((t) => t.type);
  let at = types[root % types.length]!;
  const pattern: Pattern[number][] = [{ as: "v0", type: at }];
  for (const step of walk) {
    const hops = [
      ...graph.edgeTypes.filter((e) => e.srcType === at).map((e) => ({ edge: e.edgeType, direction: "out" as const, to: e.dstType })),
      ...graph.edgeTypes.filter((e) => e.dstType === at).map((e) => ({ edge: e.edgeType, direction: "in" as const, to: e.srcType })),
    ];
    if (hops.length === 0) break;
    const hop = hops[step % hops.length]!;
    pattern.push({ edge: hop.edge, direction: hop.direction }, { as: `v${pattern.length / 2 + 0.5}`, type: hop.to });
    at = hop.to;
  }
  return pattern;
}

const key = (v: unknown) => Number(v);
const sorted = (values: unknown[]) => values.map(key).sort((x, y) => x - y);

const arbitrary = (graph: Graph) =>
  fc
    .record({
      a: fc.record({ root: fc.nat(), walk: fc.array(fc.nat(), { maxLength: 2 }) }),
      b: fc.record({ root: fc.nat(), walk: fc.array(fc.nat(), { maxLength: 2 }) }),
      step: fc.nat(),
      members: fc.uniqueArray(fc.integer({ min: 0, max: SIZE - 1 }), { minLength: 1, maxLength: SIZE }),
    })
    .map(({ a, b, step, members }) => ({
      a: relationOver(graph, patternFrom(graph, a.root, a.walk)),
      b: relationOver(graph, patternFrom(graph, b.root, b.walk)),
      step,
      members,
    }));

/** A client of `relation`: what the resolver reads at predicate time. */
const reader = (relation: Relation) => ({ relation }) as never;

/** The column a relation's vertex is read by: its variable. */
const columnOf = (relation: Relation, i: number) => relation.vertices[i % relation.vertices.length]!.variable!;

describe("one selection across relations, as properties", () => {
  it("reads a clause on one pattern from another exactly as the semi-join on its first vertex, landed by type or carried by the one shortest path", BUDGET, async () => {
    const corpus = await attach();
    const { graph } = corpus;
    await fc.assert(
      fc.asyncProperty(arbitrary(graph), async ({ a, b, step, members }) => {
        const page = crossfilterOver(graph);
        // A clause on one of A's vertices — whichever — keeping `members` of its indexes.
        const clause = onRelation(clausePoints([columnOf(a, step)], members.map((m) => [m]), { source: { reset() {} } }), a);
        page.update(clause);

        const first = b.vertices[0]!.variable!;
        const filter = page.predicate(reader(b));
        const read = await rows(corpus, Query.select({ k: first }).from(b.table).where(filter ?? []));
        if (a.key === b.key) {
          // The same relation: the clause as published, Mosaic's own.
          const own = await rows(corpus, Query.select({ k: first }).from(b.table).where(clause.predicate!));
          expect(sorted(read.map((r) => r.k))).toEqual(sorted(own.map((r) => r.k)));
          return;
        }

        // The oracle: A's kept first vertices, and B's rows whose vertex of that type is among them.
        const root = a.roots[0]!;
        const kept = new Set(sorted((await rows(corpus, Query.select({ k: root.variable! }).from(a.table).where(clause.predicate!))).map((r) => r.k)));
        const same = b.vertices.find((v) => v.type === root.type);
        const all = await rows(corpus, Query.select({ k: first, at: same?.variable ?? first }).from(b.table));
        let expected: unknown[];
        if (same) expected = all.filter((r) => kept.has(key(r.at))).map((r) => r.k);
        else {
          const source = graph.vertexTypes.find((t) => t.type === root.type)!;
          const target = graph.vertexTypes.find((t) => t.type === b.vertices[0]!.type)!;
          let where: string | null;
          try {
            where = graph.reach({ type: root.type, where: `"${source.index}" IN (${[...kept, -1].join(", ")})` }, target.type);
          } catch {
            where = null;
          }
          const reached = where === null ? new Set() : new Set(sorted((await rows(corpus, Query.select({ i: target.index }).from(verbatim(target.table)).where(verbatim(where)))).map((r) => r.i)));
          expected = all.filter((r) => reached.has(key(r.k))).map((r) => r.k);
        }
        expect(sorted(read.map((r) => r.k))).toEqual(sorted(expected));
      }),
      RUNS,
    );
  });

  it("retracts a chip's clause for every reader, whatever relation it was published on", BUDGET, async () => {
    const corpus = await attach();
    const { graph } = corpus;
    await fc.assert(
      fc.asyncProperty(fc.array(arbitrary(graph), { minLength: 1, maxLength: 4 }), fc.nat(), async (runs, chip) => {
        const page = crossfilterOver(graph);
        const resets = runs.map(() => vi.fn());
        const clauses: SelectionClause[] = runs.map(({ a, step, members }, i) =>
          onRelation(clausePoints([columnOf(a, step)], members.map((m) => [m]), { source: { reset: resets[i] } }), a),
        );
        for (const clause of clauses) page.update(clause);
        const gone = chip % clauses.length;
        page.reset([clauses[gone]!]);

        expect(resets[gone]).toHaveBeenCalledOnce();
        expect(page.clauses).not.toContain(clauses[gone]);
        // Every reader reads the page as if the clause had never been published.
        const without = crossfilterOver(graph);
        for (const [i, clause] of clauses.entries()) if (i !== gone) without.update(clause);
        for (const { b } of runs) expect(String(page.predicate(reader(b)))).toBe(String(without.predicate(reader(b))));
      }),
      RUNS,
    );
  });
});
