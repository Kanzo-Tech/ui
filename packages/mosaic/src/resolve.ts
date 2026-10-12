import { meets, relationHops, type Hop, type JoinGraph, type Relation } from "./relation.js";

/**
 * **The relation a question needs, computed rather than chosen.** What a spec names — the type it
 * counts, the types its fields are on, and the page's clauses it is read under — is a set of facts
 * about the join graph, and the relation that covers them is a shortest path through it. Kanzo
 * Tasks' Ask has the model fill the spec and this pick the relation (`/docs/design/tasks`), so a
 * filter the answer cannot reach is said before anything runs, not discovered as an empty read.
 */

export interface RelationNeeds {
  /** The type the answer is about — what it counts: the relation's root. */
  readonly root: string;
  /** The types the answer's fields are on; each must be a step of the relation. */
  readonly types?: readonly string[];
  /**
   * The root type of each relation the page's clauses were published on. A clause reaches a
   * relation through a step whose type meets its relation's root (`JoinResolver.crossing`), so each
   * must meet one of the relation's steps — a relation that reaches none of them reads the page's
   * filter as keeping nothing.
   */
  readonly under?: readonly string[];
  /** The most hops a relation may take. A question three joins away is rare; four is a guess. */
  readonly maxHops?: number;
}

export type Resolved =
  /** The one shortest relation that covers every need. */
  | { readonly kind: "relation"; readonly relation: Relation }
  /** Several, equally short: which one is the person's to say — two countries a prize has, say. */
  | { readonly kind: "ambiguous"; readonly relations: readonly Relation[] }
  /** None within `maxHops`; `missing` is what the closest relation still lacks. */
  | { readonly kind: "unreachable"; readonly missing: readonly string[] };

/** What `needs` the relation through `types` still lacks: a field's type it has no step of, a clause it meets nowhere. */
function lacking(graph: JoinGraph, types: readonly string[], needs: RelationNeeds): string[] {
  const fields = (needs.types ?? []).filter((t) => !types.includes(t));
  const clauses = (needs.under ?? []).filter((u) => !types.some((t) => meets(graph, t, u)));
  return [...new Set([...fields, ...clauses])];
}

/**
 * The shortest relation from `needs.root` whose steps cover `needs.types` and meet each of
 * `needs.under` — breadth first, in the graph's order, so one graph and one spec always resolve the
 * same way. Every relation of the shortest length that covers them is returned when there are
 * several: the tie is not broken here, because breaking it is choosing what the question meant.
 */
export function resolveRelation(graph: JoinGraph, needs: RelationNeeds): Resolved {
  const { root, maxHops = 3 } = needs;
  if (!graph.types.some((t) => t.name === root)) return { kind: "unreachable", missing: [root] };
  let level = [{ path: [] as Hop[], at: root, types: [root] }];
  let missing = lacking(graph, [root], needs);
  for (let hops = 0; ; hops++) {
    const covering = level.filter((p) => lacking(graph, p.types, needs).length === 0).map((p) => ({ root, path: p.path }));
    if (covering.length === 1) return { kind: "relation", relation: covering[0]! };
    if (covering.length > 1) return { kind: "ambiguous", relations: covering };
    for (const p of level) {
      const lacks = lacking(graph, p.types, needs);
      if (lacks.length < missing.length) missing = lacks;
    }
    if (hops === maxHops) return { kind: "unreachable", missing };
    level = level.flatMap((p) =>
      relationHops(graph, p.at)
        // Back along the edge just taken is the row it came from: a hop that adds nothing.
        .filter(({ hop }) => p.path.at(-1)?.edge !== hop.edge || p.path.at(-1)?.direction === hop.direction)
        .map(({ hop, to }) => ({ path: [...p.path, hop], at: to, types: [...p.types, to] })),
    );
  }
}
