import type { Graph, GraphConfig } from "@cosmos.gl/graph";
// The categorical scheme is on the root barrel, not `/analytics`: a graph paints from it and
// never opens a database, so the chart half is not what it needs.
import { CHART_SLOTS, categoricalCapacity, categoricalColor } from "@kanzo-tech/ui";
import type { Slice } from "./bounded";
import { resolveToken, toHex, type Rgba } from "./css-color";
import { SHAPE, SHAPE_ORDER, SHAPE_OTHER, type Look, type ShapeId } from "./graph-looks";
import type { Display, Sim } from "./types";

/**
 * From a slice to the GPU, and nothing about where the slice came from.
 *
 * `load()` used to live here — a relation in, every id, every row, an id→index map and a global
 * ranking out. ADR-0001 deleted it: the working set was N, so the ceiling was whatever N the machine
 * could hold, and 1,225 ms of first paint at 200,000 nodes was the measurement that ended the
 * argument. What replaces it is not a faster loader but a different question — `BoundedSource`
 * answers *what should I draw*, `useBoundedGraph` asks it, and this turns the answer into buffers.
 *
 * The visible consequence is that **a category is an ordinal here, never a name.** A slice carries
 * `Uint16Array` category codes because carrying twenty thousand label strings to colour twenty
 * thousand dots is paying for a vocabulary the GPU cannot read. What each ordinal is *called* is a
 * question for a legend, and a legend asks the source.
 */

/** cosmos.gl's simulation box. */
export const SPACE = 4096;

/**
 * What each channel is bound to — Plot's names, and Plot's rule about what a value means.
 *
 * **A CSS colour is a constant; anything else is a column name.** `fill="kind"` spends colour on a
 * category; `fill="var(--foreground)"` paints every point one ink and leaves colour free to mean the
 * selection. That is not our invention: it is how Plot reads the same string, and it is what makes
 * "monochrome" expressible without a look that rebinds an encoding —
 * `decisions/a-look-is-form-and-a-channel-is-a-binding.md`.
 *
 * The rule is spelled narrowly on purpose: a constant is `var(…)`, a hex, or a CSS colour function.
 * **A bare word is always a column**, so a corpus with a column called `red` is not a trap. The cost
 * is that the 148 CSS named colours are not accepted as constants, which is the trade a one-line
 * rule buys over a table nobody would keep current.
 */
export interface Channels {
  /** Which column colours a point, or a CSS colour every point wears. */
  fill?: string;
  /**
   * Which column a point's **shape** carries — Plot's `symbol`, and a peer of colour rather than a
   * decoration.
   *
   * Bound to the same column as `fill`, this is redundant encoding and costs nothing. Bound to a
   * *different* column it would need a second categorical array in the slice and in every source,
   * which is not paid for — and it is also the pairing the literature warns about, so the limit and
   * the advice point the same way. A slice carries one categorical column, and this spends shape on
   * it.
   */
  symbol?: string;
  /**
   * What tints a link. **Absent, each link takes the colour of the vertex it leaves**; a constant
   * makes links plain structure.
   *
   * No column form yet: a per-link datum — weight, confidence, recency — is a second array a slice
   * does not carry.
   */
  stroke?: string;
}

/**
 * Whether a channel's value is a **colour** — and therefore a constant rather than a column.
 *
 * Plot's test, narrowed to what a token-based system actually writes. Exported because the split it
 * decides happens in two places: the buffers paint the constant, and the query must not be asked to
 * fetch a column called `var(--foreground)`.
 */
export function isColour(value: string | undefined): value is string {
  return value !== undefined && /^(var\(|#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(value);
}

/**
 * The categorical scale the bindings imply — what colour and what shape a category ordinal wears.
 *
 * One answer for the GPU buffers, the hover card and the legend, because three answers is how a
 * legend ends up disagreeing with the canvas it explains. Values are CSS strings: the DOM resolves
 * them itself, and the buffer path resolves them once on its way to the GPU.
 *
 * `capacity` is where Other begins, and it is the document's number rather than the token
 * vocabulary's: a set derived from a client's brand names 6 to 8 real categories, not always 8. The
 * colour past it would come out muted anyway — `compile()` writes `var(--muted-foreground)` into
 * those slots — but the graph has to *count* the same way, or a legend claims eight kinds it cannot
 * tell apart.
 */
export function scaleOf(channels: Channels, capacity = CHART_SLOTS) {
  const constant = isColour(channels.fill) ? channels.fill : undefined;
  const shaped = channels.symbol !== undefined;
  return {
    color: (ordinal: number): string => {
      if (constant) return constant;
      return ordinal >= capacity
        ? "var(--muted-foreground)"
        : categoricalColor(ordinal, undefined, capacity);
    },
    // The shape order runs out at four, so the fifth ordinal and anything past it land on
    // `SHAPE_OTHER` — which is what makes the scale's claim true. Falling back to `circle` would
    // hand category 5 the glyph category 0 already wears.
    shape: (ordinal: number): ShapeId =>
      shaped ? (SHAPE_ORDER[ordinal] ?? SHAPE_OTHER) : SHAPE.circle,
  };
}

export interface Buffers {
  colors: Float32Array;
  sizes: Float32Array;
  shapes: Float32Array;
  linkColors: Float32Array;
}

/**
 * Every per-point and per-link attribute the GPU needs, from one slice and the live theme.
 *
 * `host` is the element the tokens are read against, which is what makes `var(--primary)` a legal
 * value in a look: the browser resolves it for the tree the canvas actually sits in, so the same
 * look answers differently in light and in dark.
 *
 * `display` is deliberately not an argument. Everything the reader's sliders control is a *global
 * scalar*, and a global scalar belongs in a uniform — see `appearance` — not multiplied into every
 * size and every RGBA quad that then have to be re-uploaded.
 *
 * The size ramp now spans **this slice**, not the corpus. That is the trade ADR-0001 names: a global
 * ordering is what a whole-corpus load gets for free and a bounded one cannot have. It is also
 * arguably the better question — the biggest node *here* is what a reader is looking at.
 */
export function buffers(
  slice: Slice,
  look: Look,
  host: Element,
  channels: Channels = {},
): Buffers {
  const scale = scaleOf(channels, categoricalCapacity(host));

  /** Ordinal → resolved colour, memoised: a slice of 20,000 points wears at most a handful. */
  const rgba = new Map<number, Rgba>();
  const colourOf = (ordinal: number): Rgba => {
    let resolved = rgba.get(ordinal);
    if (!resolved) {
      resolved = resolveToken(host, scale.color(ordinal));
      rgba.set(ordinal, resolved);
    }
    return resolved;
  };

  const n = slice.positions.length / 2;
  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);
  const shapes = new Float32Array(n);

  // In aggregate mode the ramp is spent on how many vertices a super-node stands for; in detail mode
  // on whatever the source ranks by. Either way it is square-rooted, because both are heavy-tailed
  // and a linear ramp leaves everything but the three biggest hubs on the floor.
  const ramp = slice.mode === "aggregate" ? slice.weights : slice.sizes;
  let lo = 0;
  let span = 1;
  if (ramp && ramp.length > 0) {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (let i = 0; i < ramp.length; i++) {
      const value = ramp[i] as number;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    lo = Math.sqrt(Number.isFinite(min) ? min : 0);
    span = Math.sqrt(max) - lo || 1;
  }

  for (let i = 0; i < n; i++) {
    const ordinal = slice.categories[i] ?? 0;
    // The slot colour is used as given. Nebula used to lighten it by degree, which is exactly the
    // kind of adjustment a validated palette cannot survive: every slot was measured for lightness
    // band, chroma floor and separation, and nudging one on the way to the GPU voids all three.
    colors.set(colourOf(ordinal), i * 4);
    const t = ramp ? (Math.sqrt(ramp[i] as number) - lo) / span : 0;
    sizes[i] = look.size[0] + t * (look.size[1] - look.size[0]);
    shapes[i] = scale.shape(ordinal);
  }

  const count = slice.links.length / 2;
  const linkColors = new Float32Array(count * 4);
  // Absent, a link takes the colour of the vertex it leaves; a constant makes links plain structure.
  const neutral = channels.stroke ? resolveToken(host, channels.stroke) : null;
  for (let e = 0; e < count; e++) {
    const src = slice.links[e * 2] ?? 0;
    const r = neutral ? neutral[0] : (colors[src * 4] ?? 0.7);
    const g = neutral ? neutral[1] : (colors[src * 4 + 1] ?? 0.7);
    const b = neutral ? neutral[2] : (colors[src * 4 + 2] ?? 0.7);
    // Alpha is 1, and it is *reserved* — for a datum that genuinely differs per link: edge weight,
    // confidence, recency. It used to carry `look.opacity × display.linkOpacity`, which is the same
    // number on every link, and paying for that cost a full re-upload of this array on every tick of
    // the Edge opacity slider. That product is a uniform now (`appearance`), and the shader
    // multiplies the two: `color.a * linkOpacity * …`. Do not spend this channel again.
    linkColors.set([r, g, b, 1], e * 4);
  }

  return { colors, sizes, shapes, linkColors };
}

/**
 * The points one hop from `index`, in both directions, **within the drawn slice**.
 *
 * This is the renderer's adjacency, not the graph's: it answers what is on screen, which is what a
 * hover highlight wants. The graph's own answer — what is adjacent whether or not it is drawn — is a
 * `neighbourhood` query, and a source that supports one answers it.
 *
 * Ours because 3.0 dropped `getAdjacentIndices` and the method that looks like its replacement is
 * not one: `getConnectedLinkIndices` filters on `n.has(d)`, so it answers only with links whose
 * *other* endpoint is also in the argument — an induced subgraph, which for a single point is its
 * self-loops. The adjacency lists themselves are still public on `graph.graph`, and each entry is a
 * `[otherPointIndex, linkIndex]` pair, so the neighbourhood is the first element of each.
 */
export function neighboursOf(graph: Graph, index: number): number[] {
  const { sourceIndexToTargetIndices, targetIndexToSourceIndices } = graph.graph;
  return [
    ...(sourceIndexToTargetIndices?.[index] ?? []).map((pair) => pair[0]),
    ...(targetIndexToSourceIndices?.[index] ?? []).map((pair) => pair[0]),
  ];
}

/** The simulation coefficients, in cosmos.gl's spelling. Shared by construction and every change. */
export function forces(sim: Sim): GraphConfig {
  return {
    simulationGravity: sim.gravity,
    simulationRepulsion: sim.repulsion,
    simulationLinkSpring: sim.linkSpring,
    simulationLinkDistance: sim.linkDistance,
    simulationFriction: sim.friction,
    simulationCluster: sim.cluster,
  };
}

/**
 * Everything the picture needs that is *one number for the whole canvas* — cosmos.gl's uniforms.
 *
 * That is the line between this and `buffers`, and it is the renderer's own: a uniform is read fresh
 * from the config on every draw, so changing one rebuilds no array and uploads nothing. Both of the
 * reader's Display sliders live here for exactly that reason, and the shaders fold them into the
 * same products the buffers used to carry — `color.a * linkOpacity`, `size * sizeScale`.
 */
export function appearance(look: Look, host: Element, display: Display): GraphConfig {
  return {
    // Always the theme's surface. Nebula used to pin a near-black of its own, which made it the one
    // look that ignored light mode — and put its fixed dark plane at odds with the light chrome
    // sitting on top of it.
    backgroundColor: toHex(resolveToken(host, "var(--background)")),
    // Points hold their screen size in every look. This was a field until all three settled on the
    // same value, at which point it was a field with one possible answer.
    scalePointsOnZoom: false,
    /** Node size. Multiplies the radius ramp `buffers` wrote, and the hit test scales with it. */
    pointSizeScale: display.pointScale,
    renderLinks: display.links,
    /** Edge opacity, the look's own and the reader's. Multiplies each link's buffer alpha. */
    linkOpacity: look.link.opacity * display.linkOpacity,
    linkDefaultWidth: look.link.width,
    linkBlending: look.link.blend,
    curvedLinks: look.link.curve > 0,
    curvedLinkControlPointDistance: look.link.curve,
    linkVisibilityDistanceRange: look.link.fade,
    linkVisibilityMinTransparency: 0.12,
    renderHoveredPointRing: true,
    hoveredPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    focusedPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    // The two greyouts are not the same kind of number, whatever the names suggest. A greyed link
    // multiplies (`opacity *= greyoutOpacity`), so it stays under the slider; a greyed point takes
    // this *instead of* `pointOpacity` — the point shader is an if/else. So a global point opacity,
    // if this canvas ever grows one, would not reach a dimmed node, and its floor would be 0.1 flat.
    pointGreyoutOpacity: 0.1,
    linkGreyoutOpacity: 0.025,
  };
}
