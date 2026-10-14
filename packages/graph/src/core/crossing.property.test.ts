import {
  clausePoints,
  crossfilterOver,
  onRelation,
  readOf,
  relationHops,
  JoinResolver,
  type Hop,
  type JoinGraph,
  type Relation,
  type RelationRef,
  type SelectionClause,
  Query,
} from "@kanzo-tech/mosaic";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { attach, type Attached } from "../../test/corpus";
import { readJoinGraph } from "./join-graph";

/**
 * **The page's one selection across relations, as properties** — `/docs/design/crossfilter#step-3`.
 * Each run takes two random relations over the corpus's joins (a type, the union of every vertex, or
 * a path of up to two hops from either), publishes a random clause on the first, and reads the second
 * through the page's resolver — against an oracle that is not the resolver: DuckDB asked for each
 * relation's rows on its own, and the semi-join done here, by hand.
 *
 * - the clause on A reaches B exactly as the semi-join on A's root key into the first step of B of a
 *   type A's root shares rows with — and as nothing where B has none;
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

/** A relation drawn from `joins`: a type and up to two hops, the hops picked by `walk`. */
function relationFrom(joins: JoinGraph, root: number, walk: readonly number[]): Relation {
  const types = joins.types.map((t) => t.name);
  let at = types[root % types.length]!;
  const path: Hop[] = [];
  for (const step of walk) {
    const hops = relationHops(joins, at);
    if (hops.length === 0) break;
    const hop = hops[step % hops.length]!;
    path.push(hop.hop);
    at = hop.to;
  }
  return { root: types[root % types.length]!, path };
}

/** The key of each step, as the relation names it, with its type: what a crossing reads. */
function identities(joins: JoinGraph, relation: RelationRef) {
  if (typeof relation === "string") {
    const type = joins.types.find((t) => t.name === relation)!;
    return [{ column: type.key, type: type.name }];
  }
  // The relation's own names for its keys — its paths — which only the joins' door spells.
  return new JoinResolver(joins).steps(relation).map((s) => ({ column: s.key, type: s.type }));
}

/** Whether rows of `a` and rows of `b` share keys: one type, or a union and a type of it. */
const meets = (joins: JoinGraph, a: string, b: string) => {
  const of = (name: string) => joins.types.find((t) => t.name === name)?.of ?? [];
  return a === b || of(a).includes(b) || of(b).includes(a);
};

const key = (v: unknown) => Number(v);
const sorted = (values: unknown[]) => values.map(key).sort((x, y) => x - y);

const arbitrary = (joins: JoinGraph) =>
  fc.record({
    a: fc.record({ root: fc.nat(), walk: fc.array(fc.nat(), { maxLength: 2 }), named: fc.boolean() }),
    b: fc.record({ root: fc.nat(), walk: fc.array(fc.nat(), { maxLength: 2 }), named: fc.boolean() }),
    step: fc.nat(),
    members: fc.uniqueArray(fc.integer({ min: 0, max: SIZE - 1 }), { minLength: 1, maxLength: SIZE }),
  }).map(({ a, b, step, members }) => {
    // A type alone is read by name half the time: its table as it is, the other form of one step.
    const pick = (r: { root: number; walk: number[]; named: boolean }): RelationRef => {
      const relation = relationFrom(joins, r.root, r.walk);
      return relation.path.length === 0 && r.named ? relation.root : relation;
    };
    return { a: pick(a), b: pick(b), step, members };
  });

/** A client of `relation`: what the resolver reads at predicate time. */
const reader = (relation: RelationRef) => ({ relation }) as never;

describe("one selection across relations, as properties", () => {
  it("reads a clause on one relation from another exactly as the semi-join on its root's key, and as nothing without a step of its type", BUDGET, async () => {
    const corpus = await attach();
    const joins = await readJoinGraph(corpus.coordinator, corpus.from);
    await fc.assert(
      fc.asyncProperty(arbitrary(joins), async ({ a, b, step, members }) => {
        const page = crossfilterOver(joins);
        // A clause on one of A's keys — a column of A, of whichever step — keeping `members`.
        const ofA = identities(joins, a);
        const column = ofA[step % ofA.length]!.column;
        const clause = onRelation(clausePoints([column], members.map((m) => [m]), { source: { reset() {} } }), a);
        page.update(clause);

        const A = readOf(joins, a).table;
        const B = readOf(joins, b).table;
        const ofB = identities(joins, b);
        const filter = page.predicate(reader(b));
        const read = await rows(corpus, Query.select({ k: ofB[0]!.column }).from(B).where(filter ?? []));

        // The oracle: A's kept roots, and B's rows whose step of a type they share is among them.
        const kept = new Set(sorted((await rows(corpus, Query.select({ k: ofA[0]!.column }).from(A).where(clause.predicate!))).map((r) => r.k)));
        const across = ofB.find((i) => meets(joins, i.type, ofA[0]!.type));
        const all = await rows(corpus, Query.select({ k: ofB[0]!.column, at: across?.column ?? ofB[0]!.column }).from(B));
        const expected = across === undefined && JSON.stringify(a) !== JSON.stringify(b) ? [] : all.filter((r) => kept.has(key(r.at))).map((r) => r.k);
        if (JSON.stringify(a) === JSON.stringify(b)) {
          // The same relation: the clause as published, Mosaic's own.
          const own = await rows(corpus, Query.select({ k: ofB[0]!.column }).from(B).where(clause.predicate!));
          expect(sorted(read.map((r) => r.k))).toEqual(sorted(own.map((r) => r.k)));
        } else {
          expect(sorted(read.map((r) => r.k))).toEqual(sorted(expected));
        }
      }),
      RUNS,
    );
  });

  it("retracts a chip's clause for every reader, whatever relation it was published on", BUDGET, async () => {
    const corpus = await attach();
    const joins = await readJoinGraph(corpus.coordinator, corpus.from);
    await fc.assert(
      fc.asyncProperty(fc.array(arbitrary(joins), { minLength: 1, maxLength: 4 }), fc.nat(), async (runs, chip) => {
        const page = crossfilterOver(joins);
        const resets = runs.map(() => vi.fn());
        const clauses: SelectionClause[] = runs.map(({ a, step, members }, i) => {
          const ofA = identities(joins, a);
          return onRelation(clausePoints([ofA[step % ofA.length]!.column], members.map((m) => [m]), { source: { reset: resets[i] } }), a);
        });
        for (const clause of clauses) page.update(clause);
        const gone = chip % clauses.length;
        page.reset([clauses[gone]!]);

        expect(resets[gone]).toHaveBeenCalledOnce();
        expect(page.clauses).not.toContain(clauses[gone]);
        // Every reader reads the page as if the clause had never been published.
        const without = crossfilterOver(joins);
        for (const [i, clause] of clauses.entries()) if (i !== gone) without.update(clause);
        for (const { b } of runs) expect(String(page.predicate(reader(b)))).toBe(String(without.predicate(reader(b))));
      }),
      RUNS,
    );
  });
});
