// Three ways the same graph can be *drawn*. Not three palettes.
//
// A look owns geometry and one encoding decision, and no colours at all. Colour belongs to the
// theme's categorical scheme, the way it belongs to a chart: `categoricalColor(i)` hands out
// `var(--chart-N)` in slot order, and every surface showing the same categories gets the same
// answer. A look that shipped its own hexes made the canvas a closed stamp — switching it changed
// what colours *mean* on screen, while switching the product's palette left the canvas untouched.
//
// This is the grammar-of-graphics split, and it is the reference model rather than a local idea:
// in Observable Plot colour is a property of the **scale**, never of the mark. A look is the mark.

export type LookId = "nebula" | "atlas" | "ink";

/**
 * cosmos.gl's `setPointShapes` enum — the members this canvas draws.
 *
 * The library ships nine: `0` Circle … `4` Pentagon, `5` Hexagon, `6` Star, `7` Cross, `8` None.
 * `None` is missing here on purpose: the point fragment shader `discard`s a `NONE` point that
 * carries no image, so "past capacity" spelled as `None` would delete the node from the picture.
 * A category nobody can name is still a node with edges.
 */
export const SHAPE = { circle: 0, square: 1, triangle: 2, diamond: 3, cross: 7 } as const;

export type ShapeId = (typeof SHAPE)[keyof typeof SHAPE];

/**
 * The shape scale, in slot order — the sibling of the colour scale.
 *
 * Plot calls this channel `symbol` and gives it its own legend, which is the tell that it is a peer
 * of colour rather than a decoration. Four slots and no cycling: a fifth category cannot wear circle
 * again without claiming to be the first one. Four, not the eight cosmos.gl could draw, because Ink
 * puts its size floor at four pixels and a pentagon, a hexagon and a circle are one dot there — a
 * scale that names more shapes than the mark can carry claims a difference nobody can see, which is
 * the same mistake `categoricalCapacity` exists to stop colour making.
 */
export const SHAPE_ORDER: ShapeId[] = [SHAPE.circle, SHAPE.square, SHAPE.triangle, SHAPE.diamond];

/**
 * What a category past the scale wears — the shape channel's `--muted-foreground`.
 *
 * No slot wears it, which is the whole point: it says *not one of the four* rather than repeating
 * the first one. This is the half that used to be missing, and the comment above was false without
 * it — `SHAPE_ORDER[4]` is `undefined`, and the fallback was `circle`.
 */
export const SHAPE_OTHER: ShapeId = SHAPE.cross;

export interface Look {
  id: LookId;
  label: string;
  blurb: string;
  /**
   * Which channel carries identity, and what the links say.
   *
   * `identity` is the field that stops Ink being a special case: it is not "the monochrome look",
   * it is the look that spends **shape** on identity and leaves colour free. Everything else about
   * it — the wide size ramp, the four-pixel floor — follows from that, because a triangle and a
   * square are the same dot below about four pixels.
   */
  encode: {
    identity: "color" | "shape";
    /** `source` tints each link with the node it leaves; `neutral` makes links plain structure. */
    links: "source" | "neutral";
  };
  form: {
    /** Radius at the lowest degree in the corpus, and at the highest. */
    size: [number, number];
    link: {
      opacity: number;
      width: number;
      /**
       * How far a link bows off the straight line, as a fraction of its length. `0` is straight.
       *
       * Keep it small. Every link curves the same way, so at cosmos.gl's default of `0.5` a few
       * hundred of them read as one pinwheel and the picture looks like it is spinning — motion
       * where there is structure. A hint is enough to tell two parallel edges apart.
       */
      curve: number;
      /**
       * Screen lengths between which a link fades out — depth, for free.
       *
       * Keep the far end generous. cosmos.gl measures this in *screen* pixels, so a range that
       * looks reasonable while zoomed in erases the whole edge layer when you zoom out, which
       * reads as "Show links stopped working".
       */
      fade: [number, number];
    };
    /** How many of the highest-degree nodes carry a standing label. */
    labels: number;
    /** A darkened rim. Mood rather than a reading aid, which is why it is form and not display. */
    vignette: boolean;
    /** Grading applied to the canvas element itself. */
    filter?: string;
  };
}

/**
 * Cosmograph's own register: small dense points and a haze of links that take their colour from
 * the node they leave, so the picture reads as flow rather than as a diagram.
 */
const NEBULA: Look = {
  id: "nebula",
  label: "Nebula",
  blurb: "Dense and dim, with links tinted by their source.",
  encode: { identity: "color", links: "source" },
  form: {
    size: [2, 8],
    link: { opacity: 0.42, width: 0.6, curve: 0, fade: [200, 1400] },
    labels: 14,
    vignette: true,
    filter: "saturate(1.1)",
  },
};

/** The default: map-steady points, links that bow just enough to separate a parallel pair. */
const ATLAS: Look = {
  id: "atlas",
  label: "Atlas",
  blurb: "Map-steady points, links that just bow, generous labels.",
  encode: { identity: "color", links: "neutral" },
  form: {
    size: [2.2, 9],
    link: { opacity: 0.45, width: 0.7, curve: 0.12, fade: [220, 1500] },
    labels: 26,
    vignette: false,
  },
};

/**
 * Structure without colour: identity moves to the shape channel and every node takes one ink, which
 * leaves colour free to mean the selection. The most legible of the three in print or on a
 * projector, and the only one whose size floor is load-bearing rather than taste.
 */
const INK: Look = {
  id: "ink",
  label: "Ink",
  blurb: "Monochrome. Kind reads as shape, degree as size.",
  encode: { identity: "shape", links: "neutral" },
  form: {
    // The floor is the whole look. A triangle and a square are the same dot below about four
    // pixels, so a ramp starting at 2 spent its only categorical channel on nodes too small to
    // spend it: every point but the handful of hubs read as an undifferentiated speck.
    size: [4, 13],
    link: { opacity: 0.28, width: 0.5, curve: 0, fade: [180, 1200] },
    labels: 40,
    vignette: false,
  },
};

export const LOOKS: Record<LookId, Look> = { nebula: NEBULA, atlas: ATLAS, ink: INK };

export const LOOK_ORDER: LookId[] = ["nebula", "atlas", "ink"];

/** The SVG path for a shape glyph inside a 12×12 box — the legend draws what the canvas draws. */
export const SHAPE_PATH: Record<ShapeId, string> = {
  [SHAPE.circle]: "M6 1.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Z",
  [SHAPE.square]: "M2 2h8v8H2Z",
  [SHAPE.triangle]: "M6 1.6 10.6 10H1.4Z",
  [SHAPE.diamond]: "M6 1 11 6l-5 5-5-5Z",
  // The proportions are cosmos.gl's own `crossDistance`: a plus with arms at 0.8 of the radius and
  // a bar 0.3 thick, so the legend's glyph is the shape the shader draws.
  [SHAPE.cross]: "M4.2 1.2h3.6v3h3v3.6h-3v3H4.2v-3h-3V4.2h3Z",
};
