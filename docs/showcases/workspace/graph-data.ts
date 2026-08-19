// The hall's archive as a graph: every closed contract, everyone who walked it, and everything it
// was about — generated once and shipped to DuckDB as two ordinary relations.
//
// The board is the wrong fixture for this. Forty-four live contracts are a list, and a list drawn as
// a network is a list with dots on it. The archive is 536 closed contracts and 938 field reports,
// and it works for the same structural reason the corpus it replaced did: **the hubs are shared**.
// A tag belongs to many contracts, a beast to many regions, a member to a whole career of work — so
// lassoing one arc pulls in contracts you did not know were related, which is the only thing a graph
// can show that a table cannot.
//
// What each vertex is:
//
//   contract   the thing being described — an `ArchivedQuest`
//   report     a leaf hanging off it, named for the role that filed it
//   tag        shared across contracts, the board's own free vocabulary
//   beast      shared across contracts and across regions
//   member     shared across contracts — `archiveOf()` is literally this edge set
//   region     shared across contracts, and a filter
//
// Every column here is a column the view actually queries: the legend groups by `kind`, the footer
// counts rows, the inspector reads a node's own attributes, and the search matches `label`.

import { ARCHIVE } from "@/example/archive";
import { MEMBERS, member } from "@/example/people";
import {
  BEASTS,
  HALLS,
  type HallId,
  REGIONS,
  TAGS,
  isoDay,
  role,
} from "@/example/world";
import { forceLayout, normalise } from "@/lib/force-layout";
import { rng } from "@/lib/rng";

/**
 * The square this fixture writes its coordinates into — **its own number, not the renderer's.**
 *
 * It used to be `SPACE` imported from `@kanzo-tech/graph`. That export is gone: the drawing side
 * takes its coordinate box from the source's `extent()`, so a fixture that scaled to a shared
 * constant was agreeing with something that had stopped reading it. Any positive number works;
 * this one is kept because the cluster-ring figures in `cluster-ring.ts` were measured against it.
 */
const EXTENT = 4096;

export type NodeKind = "contract" | "report" | "member" | "beast" | "tag" | "region";

export interface GraphNodeRow {
  id: number;
  label: string;
  kind: NodeKind;
  /** The hall that posted it — what the canvas clusters by, and a real filter. Blank on a hub. */
  hall: string;
  /** Where it happened. Blank for everything but a contract and a region. */
  region: string;
  /** The warden who signed for the party. Blank when the party had none — which is a real breach. */
  signed: string;
  degree: number;
  /** Field reports filed against a contract; 0 for everything else. An order can constrain it. */
  reports: number;
  /** The day it closed, in the world's calendar. Blank for everything but a contract. */
  closed: string;
  /** `|`-joined, so the CSV stays comma-safe. Empty for everything but contracts. */
  tags: string;
  x: number;
  y: number;
}

export interface GraphEdgeRow {
  source: number;
  target: number;
}

export interface ArchiveGraph {
  nodes: GraphNodeRow[];
  edges: GraphEdgeRow[];
  layoutMs: number;
}

/** The five halls, in charter order — the cluster domain, and the ring the canvas lays out on. */
const HALL_IDS = HALLS.map((entry) => entry.id as HallId);

/**
 * Who a field report can be signed by, drawn from the party that walked the contract.
 *
 * The world does not name individual reports, and inventing 938 titles would be inventing world
 * facts. What it does say is who was there and what each of them is for — so a report is named for
 * the **role** that filed it. That makes the leaves a six-value shared vocabulary, which is what the
 * old corpus' leaves were and what the shape of this graph depends on, and it gives the standing
 * orders something real to check: the hall names three roles whose word it takes in the field, and
 * the other three turn up in the archive anyway.
 */
function filedBy(party: readonly string[], random: ReturnType<typeof rng>): string {
  return role(member(random.pick(party)).role).id;
}

/** The warden on a party, if it had one. Blank is not missing data — it is the breach. */
function wardenOf(party: readonly string[]): string {
  const found = party.map((id) => member(id)).find((who) => who.role === "warden");
  return found?.name ?? "";
}

type RawNode = Omit<GraphNodeRow, "x" | "y" | "degree">;

/**
 * The shared vertices first, then the contracts that point at them, then the leaves.
 *
 * The order is load-bearing in the same way it was for the old corpus: a tag has to exist before any
 * contract can point at it, or every contract would carry its own private copy of the vocabulary and
 * the picture would be a forest of stars rather than a graph.
 */
function build(random: ReturnType<typeof rng>) {
  const nodes: RawNode[] = [];
  const edges: GraphEdgeRow[] = [];
  const community: number[] = [];

  const blank = { hall: "", region: "", signed: "", reports: 0, closed: "", tags: "" };

  const push = (node: RawNode, group: number): number => {
    const id = nodes.length;
    community.push(group);
    nodes.push({ ...node, id });
    return id;
  };

  const tagId = new Map<string, number>();
  for (const tag of TAGS) {
    tagId.set(tag, push({ id: 0, label: tag, kind: "tag", ...blank }, 0));
  }

  const beastId = new Map<string, number>();
  for (const entry of BEASTS) {
    beastId.set(entry.id, push({ id: 0, label: entry.label, kind: "beast", ...blank }, 0));
  }

  // A member's own name goes in `signed`, so a hub carries the same column the contracts that name
  // it do — which is what lets one property path mean one thing across every kind.
  const memberId = new Map<string, number>();
  for (const who of MEMBERS) {
    memberId.set(
      who.id,
      push({ id: 0, label: who.name, kind: "member", ...blank, signed: who.name }, 0),
    );
  }

  const regionId = new Map<string, number>();
  for (const place of REGIONS) {
    regionId.set(place, push({ id: 0, label: place, kind: "region", ...blank, region: place }, 0));
  }

  // `hall` is a column AND the cluster, and the two facts are the same one: a contract carries its
  // hall, a hub carries none. The old corpus learned this the hard way by making the group a vertex
  // as well — eight of them, each holding an edge to every node in its group, and each one dragged
  // its whole community into the centre until the picture was one ball. A value the canvas is meant
  // to *place* nodes by must not also be a node they are pulled toward. So the hall places the arcs
  // and is drawn nowhere; and the things every hall shares — a tag, a beast, a region, a member who
  // has worked for four of them — carry a blank and belong to no arc, which is why they drift
  // between the ones they join.
  for (const contract of ARCHIVE) {
    const hallIndex = HALL_IDS.indexOf(contract.hall);
    const id = push(
      {
        id: 0,
        label: contract.title,
        kind: "contract",
        hall: contract.hall,
        region: contract.region,
        signed: wardenOf(contract.party),
        reports: contract.reports,
        closed: isoDay(contract.closedDayOffset),
        tags: contract.tags.join("|"),
      },
      hallIndex,
    );

    for (const tag of contract.tags) {
      const target = tagId.get(tag);
      if (target === undefined) continue;
      edges.push({ source: id, target });
      community[target] = hallIndex;
    }

    if (contract.beast) {
      const target = beastId.get(contract.beast);
      if (target !== undefined) {
        edges.push({ source: id, target });
        community[target] = hallIndex;
      }
    }

    for (const who of contract.party) {
      const target = memberId.get(who);
      if (target === undefined) continue;
      edges.push({ source: id, target });
      community[target] = hallIndex;
    }

    const place = regionId.get(contract.region);
    if (place !== undefined) {
      edges.push({ source: id, target: place });
      community[place] = hallIndex;
    }

    // Leaves. They inherit the contract's hall for the same reason the old corpus' leaves inherited
    // their parent's group: a report belongs to the arc the work it describes belongs to.
    for (let n = 0; n < contract.reports; n++) {
      const leaf = push(
        {
          id: 0,
          label: filedBy(contract.party, random),
          kind: "report",
          ...blank,
          hall: contract.hall,
          closed: isoDay(contract.closedDayOffset),
        },
        hallIndex,
      );
      edges.push({ source: id, target: leaf });
    }
  }

  return { nodes, edges, community };
}

/** Node and edge relations with the layout already baked into `x` / `y`. */
export function buildArchiveGraph(seed = 0x4a1b): ArchiveGraph {
  const random = rng(seed);
  const { nodes: raw, edges: rawEdges, community: rawCommunity } = build(random);

  const rawDegree = new Int32Array(raw.length);
  for (const { source, target } of rawEdges) {
    rawDegree[source]!++;
    rawDegree[target]!++;
  }

  // A vertex nothing points at is a speck adrift at the edge of the canvas: it inflates the counts
  // and tells the reader nothing. Every member owes the archive at least four appearances and every
  // tag is drawn often enough that none of them is currently orphaned — but the guard stays, because
  // it is the corpus that guarantees that and not this function.
  const kept = raw.filter((_, i) => rawDegree[i]! > 0);
  const remap = new Map(kept.map((node, i) => [node.id, i]));
  const edges = rawEdges.map(({ source, target }) => ({
    source: remap.get(source)!,
    target: remap.get(target)!,
  }));
  const community = kept.map((node) => rawCommunity[node.id]!);
  const degree = kept.map((node) => rawDegree[node.id]!);

  const started = performance.now();
  const { x, y } = forceLayout(kept.length, edges, community, HALL_IDS.length, 200, random.next);
  const layoutMs = performance.now() - started;
  normalise(x);
  normalise(y);

  /**
   * Written in the space the camera asks in, and that is ADR-0001's premise rather than a detail.
   *
   * These used to be normalised to `0..1` and rescaled on the way in — `load()` mapped every seed
   * into the middle half of cosmos.gl's box. With `load()` gone there is no on-the-way-in, and there
   * must not be: a bounded source is queried with a *rectangle from the camera*, so the coordinates
   * the corpus carries have to be the coordinates the camera speaks. A rescale between them would
   * mean the index and the viewport describe different places, which is the failure this whole
   * branch exists to remove — and it showed up exactly that way, as a camera over `[1622, 2474]`
   * asking a corpus that lived inside a 1×1 square at the origin, and getting nothing.
   *
   * The middle half, because gravity pulls toward the centre and starting at the full extent would
   * open with a collapse rather than a layout.
   */
  const nodes: GraphNodeRow[] = kept.map((node, i) => ({
    ...node,
    id: i,
    x: Math.round((EXTENT * 0.25 + x[i]! * EXTENT * 0.5) * 1e5) / 1e5,
    y: Math.round((EXTENT * 0.25 + y[i]! * EXTENT * 0.5) * 1e5) / 1e5,
    degree: degree[i]!,
  }));

  return { nodes, edges, layoutMs };
}

/**
 * CSV, not `loadObjects`: one `read_csv` beats one `SELECT … UNION ALL` per row, and at 1,543 rows
 * the difference is the panel booting rather than the parser walking a megabyte of SQL.
 *
 * Nothing quoted, because nothing needs to be: a contract's title is drawn from places and openings
 * the world spells without commas, tags are single words, and `tags` is `|`-joined for exactly this
 * reason. A world that grew a comma would need a quoter here, and the CSV would say so loudly.
 */
export function nodesCsv(graph: ArchiveGraph): string {
  const out = ["id,label,kind,hall,region,signed,degree,reports,closed,tags,x,y"];
  for (const n of graph.nodes) {
    out.push(
      `${n.id},${n.label},${n.kind},${n.hall},${n.region},${n.signed},${n.degree},${n.reports},${n.closed},${n.tags},${n.x},${n.y}`,
    );
  }
  return out.join("\n");
}

export function edgesCsv(graph: ArchiveGraph): string {
  const out = ["source,target"];
  for (const e of graph.edges) out.push(`${e.source},${e.target}`);
  return out.join("\n");
}
