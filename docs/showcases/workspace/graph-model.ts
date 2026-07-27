import { Query } from "@uwdata/mosaic-sql";
import type { GraphConfigInterface } from "@cosmos.gl/graph";
import type { Coordinator } from "@kanzo-tech/ui/analytics";
import { numbers } from "@/lib/arrow";
import { onceQuery } from "@/lib/once-query";
import { categoricalColor } from "@kanzo-tech/ui/analytics";
import { resolveToken, toHex, type Rgba } from "@/lib/css-color";
import { SHAPE, SHAPE_ORDER, type Look, type ShapeId } from "./graph-looks";
import type { Display, Sim } from "./graph-state";

/**
 * What the canvas needs to know about a relation, and nothing more.
 *
 * The renderer used to read `kind`, `theme`, `publisher` and `degree` by name, and to import the
 * fixture's list of theme codes so it could turn one into a cluster index. That is a graph viewer
 * for exactly one dataset wearing the clothes of a component: point it at another relation and it
 * clusters nothing, colours nothing, and the Settings panel still offers you "Theme clustering".
 *
 * So the columns are an argument. The canvas asks *which column names a node*, *which one groups
 * them*, and reads what it is told; the vocabulary inside each column is discovered by reading the
 * data, never declared. Everything domain-specific — that this corpus calls its groups `dcat:theme`
 * and its categories `kind` — now lives at the call site, which is where a fixture belongs.
 */
export interface GraphSpec {
  /** The node relation, and the edge relation as raw `source` / `target` id pairs. */
  table: string;
  edges: string;
  idField: string;
  /** The column shown as a node's name — in labels, the hover card and the inspector. */
  labelField: string;
  /** The column driving colour and shape. Its distinct values key the look's palette. */
  categoryField: string;
  /** The column driving radius. Larger is bigger, and the label budget spends from the top. */
  sizeField: string;
  /**
   * The column whose distinct values become cluster groups, if any.
   *
   * A blank value means *no group*, not group zero — a vertex shared by every group belongs to
   * none, and left unclustered it drifts between the ones it joins.
   */
  groupField?: string;
  /** How to name that column to a reader, so no control has to hardcode a schema. */
  groupLabel?: string;
  /** Extra columns for the hover card, in the order they should read. */
  detailFields?: { field: string; label: string }[];
  /** Columns seeding the initial positions. Optional — without them the layout starts from noise. */
  xField?: string;
  yField?: string;
}

/** cosmos.gl's simulation box. Positions are seeded into the middle half of it. */
export const SPACE = 4096;

export interface NodeRow {
  id: number;
  label: string;
  category: string;
  size: number;
  /** The raw group value, blank when the node belongs to none. */
  group: string;
  /** The spec's detail columns, already formatted. */
  details: { label: string; value: string }[];
}

export interface Loaded {
  ids: number[];
  index: Map<number, number>;
  rows: NodeRow[];
  positions: Float32Array;
  /** Group index per node, `undefined` for the vertices no group owns. */
  clusters: (number | undefined)[];
  links: Float32Array;
  minSize: number;
  maxSize: number;
  /** Indices by descending size — the label budget spends from the front. */
  ranked: number[];
  /** The distinct categories the data actually contains, in first-seen order. */
  categories: string[];
}

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: a DATE column arrives as a
 * `Date`, and rendering one crashes React with "Objects are not valid as a React child".
 */
function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

export async function load(coordinator: Coordinator, spec: GraphSpec): Promise<Loaded> {
  const columns: Record<string, string> = {
    id: spec.idField,
    label: spec.labelField,
    category: spec.categoryField,
    size: spec.sizeField,
  };
  if (spec.groupField) columns.group = spec.groupField;
  if (spec.xField) columns.x = spec.xField;
  if (spec.yField) columns.y = spec.yField;
  for (const detail of spec.detailFields ?? []) columns[`d_${detail.field}`] = detail.field;

  const raw = Array.from(
    (await onceQuery(coordinator, () =>
      Query.from(spec.table).select(columns).orderby(spec.idField),
    )) as Iterable<Record<string, unknown>>,
  );
  const edges = await onceQuery(coordinator, () =>
    Query.from(spec.edges).select({ source: "source", target: "target" }),
  );

  const n = raw.length;
  const ids: number[] = new Array(n);
  const index = new Map<number, number>();
  const rows: NodeRow[] = new Array(n);
  const positions = new Float32Array(n * 2);
  const clusters: (number | undefined)[] = new Array(n);
  // Both vocabularies are discovered, not declared: distinct values in, indices out.
  const groups = new Map<string, number>();
  const categories = new Map<string, number>();
  let minSize = Number.POSITIVE_INFINITY;
  let maxSize = 0;

  for (let i = 0; i < n; i++) {
    const row = raw[i] as Record<string, unknown>;
    const id = Number(row.id);
    const size = Number(row.size) || 0;
    const category = text(row.category);
    const group = text(row.group);
    ids[i] = id;
    index.set(id, i);
    if (!categories.has(category)) categories.set(category, categories.size);
    rows[i] = {
      id,
      label: text(row.label),
      category,
      size,
      group,
      details: (spec.detailFields ?? [])
        .map((detail) => ({ label: detail.label, value: text(row[`d_${detail.field}`]) }))
        .filter((detail) => detail.value !== ""),
    };
    // Seeded into the middle half: gravity pulls to the centre, and starting at the full extent
    // would open with a collapse rather than a layout.
    const seedX = spec.xField ? Number(row.x) : Math.random();
    const seedY = spec.yField ? Number(row.y) : Math.random();
    positions[i * 2] = SPACE * 0.25 + seedX * SPACE * 0.5;
    positions[i * 2 + 1] = SPACE * 0.25 + seedY * SPACE * 0.5;
    if (group === "") {
      clusters[i] = undefined;
    } else {
      let slot = groups.get(group);
      if (slot === undefined) {
        slot = groups.size;
        groups.set(group, slot);
      }
      clusters[i] = slot;
    }
    if (size < minSize) minSize = size;
    if (size > maxSize) maxSize = size;
  }

  const source = numbers(edges, "source");
  const target = numbers(edges, "target");
  const links = new Float32Array(source.length * 2);
  for (let e = 0; e < source.length; e++) {
    links[e * 2] = index.get(source[e] as number) ?? 0;
    links[e * 2 + 1] = index.get(target[e] as number) ?? 0;
  }

  const ranked = rows.map((_, i) => i).sort((a, b) => (rows[b]?.size ?? 0) - (rows[a]?.size ?? 0));

  return {
    ids,
    index,
    rows,
    positions,
    clusters,
    links,
    minSize: Number.isFinite(minSize) ? minSize : 1,
    maxSize: maxSize || 1,
    ranked,
    categories: [...categories.keys()],
  };
}

// ── Look → GPU ───────────────────────────────────────────────────────────────

/**
 * The categorical scale a look implies — what colour and what shape a category wears.
 *
 * One answer for the GPU buffers, the hover card and the legend, because three answers is how a
 * legend ends up disagreeing with the canvas it explains. Values are CSS strings: the DOM resolves
 * them itself, and the buffer path resolves them once on its way to the GPU.
 *
 * `categories` is the data's own first-seen order, so the domain comes from the relation rather
 * than from anything the look declares — point the canvas at another corpus and it still colours.
 */
export function scaleOf(look: Look, categories: string[]) {
  const mono = look.encode.identity === "shape";
  return {
    color: (category: string): string => {
      if (mono) return "var(--foreground)";
      const index = categories.indexOf(category);
      return index < 0 ? "var(--muted-foreground)" : categoricalColor(index);
    },
    shape: (category: string): ShapeId =>
      mono ? (SHAPE_ORDER[categories.indexOf(category)] ?? SHAPE.circle) : SHAPE.circle,
  };
}

export interface Buffers {
  colors: Float32Array;
  sizes: Float32Array;
  shapes: Float32Array;
  linkColors: Float32Array;
}

/**
 * Every visual attribute the GPU needs, recomputed from a look and the live theme.
 *
 * `host` is the element the tokens are read against, which is what makes `var(--primary)` a legal
 * value in a look: the browser resolves it for the tree the canvas actually sits in, so the same
 * look answers differently in light and in dark.
 */
export function buffers(data: Loaded, look: Look, host: Element, display: Display): Buffers {
  /**
   * Category → slot, in first-seen order, straight from the theme's categorical scale.
   *
   * The look no longer answers this. `categoricalColor(i)` is the same function a chart legend and
   * a table chip would call, so the same category is the same colour wherever it appears, and
   * choosing a different scheme in Preferences re-colours the canvas along with everything else.
   * Past the last slot it hands back the muted token rather than cycling — a ninth category
   * wearing slot 1 would claim to be the first one.
   */
  const scale = scaleOf(look, data.categories);
  const rgba = new Map<string, Rgba>();
  for (const name of data.categories) rgba.set(name, resolveToken(host, scale.color(name)));
  const fallback = resolveToken(host, "var(--muted-foreground)");

  const n = data.rows.length;
  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);
  const shapes = new Float32Array(n);
  const lo = Math.sqrt(data.minSize);
  const span = Math.sqrt(data.maxSize) - lo || 1;

  for (let i = 0; i < n; i++) {
    const row = data.rows[i] as NodeRow;
    // Square-rooted, because a degree-like column is heavy-tailed and a linear ramp would leave
    // everything but the three biggest hubs at the floor.
    const t = (Math.sqrt(row.size) - lo) / span;
    // The slot colour is used as given. Nebula used to lighten it by degree, which is exactly the
    // kind of adjustment a validated palette cannot survive: every slot was measured for lightness
    // band, chroma floor and separation, and nudging one on the way to the GPU voids all three.
    colors.set(rgba.get(row.category) ?? fallback, i * 4);
    sizes[i] = (look.form.size[0] + t * (look.form.size[1] - look.form.size[0])) * display.pointScale;
    shapes[i] = scale.shape(row.category);
  }

  const count = data.links.length / 2;
  const linkColors = new Float32Array(count * 4);
  const uniform =
    look.encode.links === "source" ? null : resolveToken(host, "var(--muted-foreground)");
  const alpha = look.form.link.opacity * display.linkOpacity;
  for (let e = 0; e < count; e++) {
    const src = data.links[e * 2] ?? 0;
    const r = uniform ? uniform[0] : (colors[src * 4] ?? 0.7);
    const g = uniform ? uniform[1] : (colors[src * 4 + 1] ?? 0.7);
    const b = uniform ? uniform[2] : (colors[src * 4 + 2] ?? 0.7);
    linkColors.set([r, g, b, alpha], e * 4);
  }

  return { colors, sizes, shapes, linkColors };
}

/** The simulation coefficients, in cosmos.gl's spelling. Shared by construction and every change. */
export function forces(sim: Sim): GraphConfigInterface {
  return {
    simulationGravity: sim.gravity,
    simulationRepulsion: sim.repulsion,
    simulationLinkSpring: sim.linkSpring,
    simulationLinkDistance: sim.linkDistance,
    simulationFriction: sim.friction,
    simulationCluster: sim.cluster,
  };
}

export function appearance(look: Look, host: Element, display: Display): GraphConfigInterface {
  return {
    // Always the theme's surface. Nebula used to pin a near-black of its own, which made it the one
    // look that ignored light mode — and put its fixed dark plane at odds with the light chrome
    // sitting on top of it.
    backgroundColor: toHex(resolveToken(host, "var(--background)")),
    // Points hold their screen size in every look. This was a field until all three settled on the
    // same value, at which point it was a field with one possible answer.
    scalePointsOnZoom: false,
    renderLinks: display.links,
    linkDefaultWidth: look.form.link.width,
    curvedLinks: look.form.link.curve > 0,
    curvedLinkControlPointDistance: look.form.link.curve,
    linkVisibilityDistanceRange: look.form.link.fade,
    linkVisibilityMinTransparency: 0.12,
    renderHoveredPointRing: true,
    hoveredPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    focusedPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    pointGreyoutOpacity: 0.1,
    linkGreyoutOpacity: 0.025,
  };
}

