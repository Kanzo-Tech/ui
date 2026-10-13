import { meets, relationHops, relationSteps, type Hop, type JoinGraph, type Relation } from "./relation.js";

/**
 * **The relation a question needs, computed rather than chosen.** What a spec names — the type it
 * counts, the types it shows, the types its filters are on, and the page's clauses it is read under —
 * is a set of facts about the join graph. What it shows is one path from the measured type; what it
 * is filtered by is a star around that path, each branch a relation of its own crossed in by its
 * key, as semantic layers join a measure's filters from its entity (`/docs/design/tasks`). Kanzo
 * Tasks' Ask has the model fill the spec and this pick the relations, so a filter the answer cannot
 * reach is said before anything runs, not discovered as an empty read.
 */

export interface RelationNeeds {
  /** The type the answer is about — what it counts: the relation's root. */
  readonly root: string;
  /** The types the answer shows; each must be a step of the relation. */
  readonly types?: readonly string[];
  /**
   * The types the answer's filters are on. Each is a step of the relation, or the last type of a
   * relation of its own in `through`, rooted at the step nearest to it.
   */
  readonly filters?: readonly string[];
  /**
   * The root type of each relation the page's clauses were published on. A clause reaches a
   * relation through a step whose type meets its relation's root (`JoinResolver.crossing`), so each
   * must meet one of the relation's steps — a relation that reaches none of them reads the page's
   * filter as keeping nothing.
   */
  readonly under?: readonly string[];
  /** The most hops a relation, or a branch, may take. A question three joins away is rare; four is a guess. */
  readonly maxHops?: number;
}

/**
 * A relation and the branches its filters are read through. Each branch is rooted at a type of the
 * relation, and narrows it as a page's clause on another relation does: a semi-join on that step's
 * key (`JoinResolver.crossing`).
 */
export interface Resolution {
  readonly relation: Relation;
  readonly through: readonly Relation[];
}

export type Resolved =
  /** The one shortest relation, with its branches, that covers every need. */
  | ({ readonly kind: "relation" } & Resolution)
  /** Several, equally short: which one is the person's to say — two countries a prize has, say. */
  | { readonly kind: "ambiguous"; readonly options: readonly Resolution[] }
  /** None within `maxHops`; `missing` is what the closest relation still lacks. */
  | { readonly kind: "unreachable"; readonly missing: readonly string[] };

type Need = Pick<RelationNeeds, "types" | "under">;

/** What `needs` the relation through `types` still lacks: a type it has no step of, a clause it meets nowhere. */
function lacking(graph: JoinGraph, types: readonly string[], needs: Need): string[] {
  const fields = (needs.types ?? []).filter((t) => !types.includes(t));
  const clauses = (needs.under ?? []).filter((u) => !types.some((t) => meets(graph, t, u)));
  return [...new Set([...fields, ...clauses])];
}

/**
 * The shortest relations from any of `roots` that cover `needs`: breadth first, in the graph's order,
 * never back along the edge just taken. All of the shortest length, or what the closest still lacks.
 */
function shortest(graph: JoinGraph, roots: readonly string[], needs: Need, maxHops: number): Relation[] | { missing: string[] } {
  let level = roots.map((root) => ({ root, path: [] as Hop[], at: root, types: [root] }));
  let missing = lacking(graph, [], needs);
  for (let hops = 0; ; hops++) {
    const covering = level.filter((p) => !lacking(graph, p.types, needs).length);
    if (covering.length) return covering.map(({ root, path }) => ({ root, path }));
    for (const p of level) {
      const lacks = lacking(graph, p.types, needs);
      if (lacks.length < missing.length) missing = lacks;
    }
    if (hops === maxHops) return { missing };
    level = level.flatMap((p) => {
      const last = p.path.at(-1);
      return (
        relationHops(graph, p.at)
          // Back along the edge just taken is the row it came from: a hop that adds nothing.
          .filter(({ hop }) => last?.edge !== hop.edge || last.direction === hop.direction)
          .map(({ hop, to }) => ({ root: p.root, path: [...p.path, hop], at: to, types: [...p.types, to] }))
      );
    });
  }
}

/**
 * The shortest relation from `needs.root` whose steps cover `needs.types` and meet each of
 * `needs.under`, and for each of `needs.filters` it has no step of, the shortest branch from any of
 * its steps that reaches it. Breadth first, in the graph's order, so one graph and one spec always
 * resolve the same way. Every combination of the shortest is returned when there are several: the
 * tie is not broken here, because breaking it is choosing what the question meant.
 */
export function resolveRelation(graph: JoinGraph, needs: RelationNeeds): Resolved {
  const { root, maxHops = 3 } = needs;
  if (!graph.types.some((t) => t.name === root)) return { kind: "unreachable", missing: [root] };
  const mains = shortest(graph, [root], needs, maxHops);
  if (!Array.isArray(mains)) return { kind: "unreachable", ...mains };
  const options: Resolution[] = [];
  for (const relation of mains) {
    const steps = relationSteps(graph, relation).map((s) => s.type);
    let combos: Relation[][] = [[]];
    for (const type of new Set(needs.filters)) {
      if (steps.includes(type)) continue;
      const branches = shortest(graph, [...new Set(steps)], { types: [type] }, maxHops);
      if (!Array.isArray(branches)) return { kind: "unreachable", ...branches };
      combos = combos.flatMap((c) => branches.map((b) => [...c, b]));
    }
    options.push(...combos.map((through) => ({ relation, through })));
  }
  return options.length > 1 ? { kind: "ambiguous", options } : { kind: "relation", ...options[0]! };
}
