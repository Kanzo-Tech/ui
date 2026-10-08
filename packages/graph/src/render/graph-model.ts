import type { GraphConfig } from "@cosmos.gl/graph";
import { CHART_SLOTS, categoricalCapacity, categoricalColor } from "@kanzo-tech/ui";
import { isColour, type Channels } from "../core/channels";
import type { Encoding, Geometry } from "../core/load";
import { resolveToken, toHex, type Rgba } from "./css-color";
import { SHAPE_INDEX, SHAPE_ORDER, SHAPE_OTHER, type Look, type Shape } from "./graph-looks";
import type { Sim } from "./graph-sim";

/**
 * The categorical scale the bindings imply — what colour and what shape a category rank wears.
 *
 * One answer for the GPU buffers, the hover card and the legend, because three answers is how a
 * legend ends up disagreeing with the canvas it explains. Values are CSS strings: the DOM resolves
 * them itself, and the buffer path resolves them once on its way to the GPU.
 *
 * `capacity` is where Other begins, and it is the document's number rather than the token
 * vocabulary's: a set derived from a client's brand names 6 to 8 real categories, not always 8.
 */
export function scaleOf(channels: Channels, capacity = CHART_SLOTS) {
  const constant = isColour(channels.fill) ? channels.fill : undefined;
  const shaped = channels.symbol !== undefined;
  return {
    color: (ordinal: number): string => {
      if (constant) return constant;
      return ordinal >= capacity ? "var(--muted-foreground)" : categoricalColor(ordinal, undefined, capacity);
    },
    shape: (ordinal: number): Shape => (shaped ? (SHAPE_ORDER[ordinal] ?? SHAPE_OTHER) : "circle"),
  };
}

export interface Paint {
  colors: Float32Array;
  sizes: Float32Array;
  shapes: Float32Array;
  linkColors: Float32Array;
}

/**
 * Every per-point and per-link attribute, from the loaded graph and the live theme — what a binding,
 * a look or a theme change re-uploads, and all it re-uploads.
 *
 * `host` is the element the tokens are read against, so `var(--primary)` resolves for the tree the
 * canvas sits in. The ramp is `√value` over the whole graph, and a vertex with no value takes the
 * smallest radius.
 */
export function paint(geometry: Geometry, encoding: Encoding, look: Look, host: Element, channels: Channels = {}): Paint {
  const scale = scaleOf(channels, categoricalCapacity(host));
  const rgba = new Map<number, Rgba>();
  const colourOf = (ordinal: number): Rgba => {
    let resolved = rgba.get(ordinal);
    if (!resolved) rgba.set(ordinal, (resolved = resolveToken(host, scale.color(ordinal))));
    return resolved;
  };
  const n = geometry.size;
  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);
  const shapes = new Float32Array(n);
  const ramp = encoding.sizes;
  let lo = 0;
  let span = 1;
  if (ramp) {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const value = ramp[i] as number;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    lo = Math.sqrt(Number.isFinite(min) ? min : 0);
    span = Math.sqrt(max) - lo || 1;
  }
  for (let i = 0; i < n; i++) {
    const ordinal = encoding.ranks[i] ?? 0;
    colors.set(colourOf(ordinal), i * 4);
    const value = ramp ? (ramp[i] as number) : Number.NaN;
    const t = Number.isNaN(value) ? 0 : (Math.sqrt(value) - lo) / span;
    sizes[i] = look.size[0] + t * (look.size[1] - look.size[0]);
    shapes[i] = SHAPE_INDEX[scale.shape(ordinal)] as number;
  }

  const count = geometry.links.length / 2;
  const linkColors = new Float32Array(count * 4);
  const neutral = channels.stroke ? resolveToken(host, channels.stroke) : null;
  for (let e = 0; e < count; e++) {
    const src = geometry.links[e * 2] ?? 0;
    // Link alpha stays 1: `linkOpacity` and the distance fade multiply into it, and a second
    // opacity here would compound with both.
    linkColors[e * 4] = neutral ? neutral[0] : (colors[src * 4] ?? 0.7);
    linkColors[e * 4 + 1] = neutral ? neutral[1] : (colors[src * 4 + 1] ?? 0.7);
    linkColors[e * 4 + 2] = neutral ? neutral[2] : (colors[src * 4 + 2] ?? 0.7);
    linkColors[e * 4 + 3] = 1;
  }
  return { colors, sizes, shapes, linkColors };
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
 * Everything the picture needs that is *one number for the whole canvas* — cosmos.gl's uniforms, read
 * fresh on every draw, so a look change costs a `setConfigPartial` and no upload at all.
 */
export function appearance(look: Look, host: Element): GraphConfig {
  // Cleared transparent, as Cosmograph keeps cosmos.gl's canvas: the element paints the background, so
  // the grid can lie between it and the points. The RGB stays because the greyout reads it to dim
  // towards the page, darker on a dark one and lighter on a light one.
  const [r, g, b] = resolveToken(host, "var(--background)");
  return {
    backgroundColor: [r, g, b, 0],
    // Screen pixels, cosmos.gl's default and Cosmograph's: `/docs/design/graph` has the measurement.
    scalePointsOnZoom: false,
    renderLinks: look.link.render,
    linkOpacity: look.link.opacity,
    linkDefaultWidth: look.link.width,
    linkBlending: look.link.blend,
    curvedLinks: look.link.curve > 0,
    curvedLinkControlPointDistance: look.link.curve,
    linkVisibilityDistanceRange: look.link.fade,
    linkVisibilityMinTransparency: 0.12,
    renderHoveredPointRing: true,
    hoveredPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    focusedPointRingColor: toHex(resolveToken(host, "var(--primary)")),
    pointGreyoutOpacity: 0.1,
    linkGreyoutOpacity: 0.025,
  };
}
