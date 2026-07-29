// The Discovery corpus: a metadata knowledge graph, generated once and shipped to DuckDB as two
// ordinary relations.
//
// The point of the shape: keywords, publishers and themes are **shared** between datasets. That
// sharing is what makes this a graph rather than a forest of stars — it is why lassoing a cluster
// pulls in datasets you did not know were related, and why a keyword is a hub with a real degree.
//
// Every column here is a column the view actually queries: the legend groups by `kind`, the footer
// counts rows, the inspector reads a node's own attributes, and the search matches `label`.

import { forceLayout, mulberry32, normalise } from "@/lib/force-layout";

export type NodeKind = "dataset" | "distribution" | "keyword" | "entity";

export interface GraphNodeRow {
  id: number;
  label: string;
  kind: NodeKind;
  /** EU data-theme code — what the canvas clusters by, and a real filter. */
  theme: string;
  publisher: string;
  degree: number;
  /** Distributions the dataset declares; 0 for everything else. A shape can constrain it. */
  distributions: number;
  issued: string;
  /** `|`-joined, so the CSV stays comma-safe. Empty for everything but datasets. */
  keywords: string;
  x: number;
  y: number;
}

export interface GraphEdgeRow {
  source: number;
  target: number;
}

export interface DiscoveryGraph {
  nodes: GraphNodeRow[];
  edges: GraphEdgeRow[];
  layoutMs: number;
}

const THEMES = ["ENVI", "REGI", "HEAL", "ECON", "TRAN", "ENER", "AGRI", "SOCI"] as const;

const PUBLISHERS = [
  "AEMET", "INE", "IGN", "MITECO", "Eurostat", "EEA",
  "Copernicus", "CNIG", "ISCIII", "IDAE", "MAPA", "CSIC",
] as const;

const TOPICS = [
  "observations", "stations", "forecast", "climate-normals", "air-quality", "emissions",
  "census", "population", "mortality", "hospital-beds", "employment", "prices",
  "elevation", "land-cover", "coastline", "river-basins", "protected-areas", "forest-inventory",
  "traffic-counts", "rail-network", "port-calls", "mobility", "energy-mix", "solar-capacity",
  "wind-capacity", "grid-load", "crop-yield", "soil-moisture", "irrigation", "livestock",
];

const FORMATS = ["parquet", "csv", "graphar", "json", "geojson", "netcdf"] as const;

const KEYWORDS = [
  "weather", "spain", "climate", "temperature", "rainfall", "wind", "air-quality", "emissions",
  "stations", "hourly", "daily", "satellite", "sensors", "population", "census", "energy",
  "solar", "wind-power", "agriculture", "soil", "water", "rivers", "coast", "marine",
  "forest", "biodiversity", "health", "mortality", "hospital", "mobility", "traffic", "transport",
  "rail", "urban", "gdp", "employment", "prices", "tourism", "geospatial", "elevation",
];

const DATASETS = 180;

function slug(publisher: string): string {
  return publisher.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Datasets first, then the things they point at. Keywords and publishers are drawn with a
 * degree-proportional bias — a keyword already used by many datasets is likelier to be used
 * again — which is the cheap way to get the hub structure a real catalogue has.
 */
function build(rand: () => number) {
  const nodes: Omit<GraphNodeRow, "x" | "y" | "degree">[] = [];
  const edges: GraphEdgeRow[] = [];
  const community: number[] = [];

  // The shared vertices exist before any dataset, so every dataset can point at the same ones.
  const keywordId = new Map<string, number>();
  for (const word of KEYWORDS) {
    keywordId.set(word, nodes.length);
    community.push(0);
    nodes.push({
      id: nodes.length, label: word, kind: "keyword",
      theme: "", publisher: "", issued: "", keywords: "", distributions: 0,
    });
  }

  const publisherId = new Map<string, number>();
  for (const name of PUBLISHERS) {
    publisherId.set(name, nodes.length);
    community.push(0);
    nodes.push({
      id: nodes.length, label: name, kind: "entity",
      theme: "", publisher: name, issued: "", keywords: "", distributions: 0,
    });
  }

  // `theme` is deliberately NOT a vertex. It was, and eight vertices carrying an edge to every
  // dataset in their theme turned the picture into one ball: a hub with degree 20+ drags its whole
  // community into the centre, and gravity does the rest. A theme is an *attribute* — it stays a
  // column, colours nothing, filters everything, and places the clusters. The rule this taught:
  // put a value in the graph only when you want to see it pulled on.
  //
  // Being an attribute is also why the seed below cannot separate themes and the canvas' cluster
  // force can: the seed follows edges, and the edges cross themes because keywords are shared.

  // Weighted bags: a draw is proportional to how often the value has already been chosen.
  const keywordBag = [...KEYWORDS];

  for (let d = 0; d < DATASETS; d++) {
    const publisher = PUBLISHERS[(rand() * PUBLISHERS.length) | 0]!;
    const topic = TOPICS[(rand() * TOPICS.length) | 0]!;
    const themeIndex = (rand() * THEMES.length) | 0;
    const theme = THEMES[themeIndex]!;
    const year = 2019 + ((rand() * 7) | 0);
    const month = 1 + ((rand() * 12) | 0);
    const day = 1 + ((rand() * 28) | 0);
    const issued = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const picked = new Set<string>();
    const wanted = 2 + ((rand() * 3) | 0);
    while (picked.size < wanted) picked.add(keywordBag[(rand() * keywordBag.length) | 0]!);

    const id = nodes.length;
    community.push(themeIndex);
    nodes.push({
      id,
      label: `${slug(publisher)}.${topic}`,
      kind: "dataset",
      theme,
      publisher,
      issued,
      keywords: [...picked].join("|"),
      distributions: 0,
    });

    for (const word of picked) {
      edges.push({ source: id, target: keywordId.get(word)! });
      // Re-seeding the bag is what makes popular keywords keep winning.
      keywordBag.push(word);
      community[keywordId.get(word)!] = themeIndex;
    }
    edges.push({ source: id, target: publisherId.get(publisher)! });
    community[publisherId.get(publisher)!] = themeIndex;

    const distributions = 1 + ((rand() * 3) | 0);
    const formats = new Set<string>();
    while (formats.size < distributions) formats.add(FORMATS[(rand() * FORMATS.length) | 0]!);
    for (const format of formats) {
      const distId = nodes.length;
      community.push(themeIndex);
      nodes.push({
        id: distId,
        label: format,
        kind: "distribution",
        theme,
        publisher,
        issued,
        keywords: "",
        distributions: 0,
      });
      edges.push({ source: id, target: distId });
    }
    (nodes[id] as { distributions: number }).distributions = formats.size;
  }

  return { nodes, edges, community };
}

/** Node and edge relations with the layout already baked into `x` / `y`. */
export function buildDiscoveryGraph(seed = 20260726): DiscoveryGraph {
  const rand = mulberry32(seed);
  const { nodes: raw, edges: rawEdges, community: rawCommunity } = build(rand);

  const rawDegree = new Int32Array(raw.length);
  for (const { source, target } of rawEdges) {
    rawDegree[source]!++;
    rawDegree[target]!++;
  }

  // A keyword no dataset happened to draw is a vertex with no edges: it renders as a speck adrift
  // at the edge of the canvas, inflates the counts and tells the reader nothing. Dropped before the
  // layout runs, so the ids the view publishes are the ids that exist.
  const kept = raw.filter((_, i) => rawDegree[i]! > 0);
  const remap = new Map(kept.map((node, i) => [node.id, i]));
  const edges = rawEdges.map(({ source, target }) => ({
    source: remap.get(source)!,
    target: remap.get(target)!,
  }));
  const community = kept.map((node) => rawCommunity[node.id]!);
  const degree = kept.map((node) => rawDegree[node.id]!);

  const started = performance.now();
  const { x, y } = forceLayout(kept.length, edges, community, THEMES.length, 200, rand);
  const layoutMs = performance.now() - started;
  normalise(x);
  normalise(y);

  const nodes: GraphNodeRow[] = kept.map((node, i) => ({
    ...node,
    id: i,
    degree: degree[i]!,
    x: Math.round(x[i]! * 1e5) / 1e5,
    y: Math.round(y[i]! * 1e5) / 1e5,
  }));

  return { nodes, edges, layoutMs };
}

/** CSV, not `loadObjects`: one `read_csv` beats one `SELECT … UNION ALL` per row. */
export function nodesCsv(graph: DiscoveryGraph): string {
  const out = ["id,label,kind,theme,publisher,degree,distributions,issued,keywords,x,y"];
  for (const n of graph.nodes) {
    out.push(
      `${n.id},${n.label},${n.kind},${n.theme},${n.publisher},${n.degree},${n.distributions},${n.issued},${n.keywords},${n.x},${n.y}`,
    );
  }
  return out.join("\n");
}

export function edgesCsv(graph: DiscoveryGraph): string {
  const out = ["source,target"];
  for (const e of graph.edges) out.push(`${e.source},${e.target}`);
  return out.join("\n");
}

export const GRAPH_THEMES = THEMES;
