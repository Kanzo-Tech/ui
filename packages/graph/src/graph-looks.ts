// Three registers the same graph can be *drawn* in. Not three palettes, and — since
// `decisions/a-look-is-form-and-a-channel-is-a-binding.md` — not three encodings either.
//
// **A look is form and nothing else.** No colours: colour belongs to the theme's categorical
// scheme, the way it belongs to a chart, so every surface showing the same categories gets the same
// answer. And no encoding: what a channel carries is bound by whoever draws the graph, under Plot's
// names. A look that decided whether identity reached the GPU as colour or as shape was a theme
// reaching into an encoding — Vega-Lite states the general rule, that `config` sets defaults for
// marks, scales, axes and legends and may not touch `encoding` — and its concrete cost was a `fill`
// binding that painted nothing under the look named Ink.
//
// This is the grammar-of-graphics split, and it is the reference model rather than a local idea:
// in Observable Plot colour is a property of the **scale**, never of the mark, and the mark carries
// the channels. A look is the mark's geometry.
//
// The three names survive as **recommended pairings** — a form plus the bindings that were bundled
// with it — offered by the host that draws the graph. A host offering three arrangements it authored
// is not the same act as a preference silently discarding the caller's binding.

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
 * again without claiming to be the first one.
 *
 * **Four because the shape channel's measured capacity is five, not because small shapes stop being
 * distinguishable.** Giovannangeli et al. (arXiv 2103.06084) put the ceiling at **5 for shape**
 * against **7 for colour**; `SHAPE_ORDER`'s four plus `SHAPE_OTHER` is exactly five distinguishable
 * glyphs, and the two scales differ in cardinality because the channels do. The colour side already
 * says the same thing from the other end — Dracula's document publishes `--chart-capacity: 7`.
 *
 * **This comment used to give the size argument, and the size argument is wrong.** It said a
 * pentagon, a hexagon and a circle are one dot at Ink's floor. Smart & Szafir (CHI 2019,
 * doi:10.1145/3290605.3300899) measured 16 shapes across 6 mark sizes from 6 to 50 px and found
 * shape discrimination *robust* to size: the only significant variation is at 6 px, and it is 4.5
 * accuracy points against 50 px. The conclusion survived the argument that was given for it, which
 * is the most dangerous shape a comment can have — see `OBLIGATIONS` in `./obligations.ts` for what
 * the floor actually protects.
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

/**
 * The geometry a canvas draws — and nothing else.
 *
 * **No `id`, no `label`, no `blurb`.** Those three were a picker's metadata, and the picker was a
 * list of three names that turned out to be two pictures. What a person chooses is declared in
 * `look-section.ts` as axes and resolved by `lookFrom`; what a renderer consumes is this.
 */
export interface Look {
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
     * Whether links **add** where they overlap, instead of compositing over one another.
     *
     * cosmos.gl's default is on, which is a choice nobody here made and which the archive made
     * visible: 4,280 grey links at 0.45 summed to a white spray that swallowed 1,543 points of
     * 2–9 px. Every point was uploaded, none was legible, and the picture read as *the nodes are
     * not rendering*.
     *
     * On, it is a real register rather than a bug — additive light is what makes a dense graph read
     * as flow — so it belongs to the form that wants it and not to the renderer's defaults.
     */
    blend: boolean;
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
  // There is no `filter`, and its absence is a rule rather than an omission. Nebula carried
  // `saturate(1.1)` on the canvas element — the one thing left in a Look that touched hue, and a
  // chroma multiplier is colour wearing geometry's clothes. Measured over Kanzo's eight slots
  // (2026-08-13, `saturate(1.1)` through the same filter engine the browser applies): it moved
  // every slot, by ΔE 0.85 to **8.05**, which is the size of the separation `deriveScheme`
  // *guarantees* between two different categories. It did not break that separation here —
  // the closest pair went from ΔE 32.36 to 30.38, with room to spare — so the reason it is gone
  // is not a failure it caused, it is that a look must not be able to cause one. The whole claim
  // of the colour layer is that what ships is what was derived and measured; a post-process on
  // the canvas voids it silently, and `graph-model.ts` already forbids the same move one layer
  // down ("nudging one on the way to the GPU voids all three").
}

/**
 * The form a canvas draws, from the axes a person chose.
 *
 * **One function and no table of constants**, which is the shape the axes forced and the reason
 * the three named looks are gone. They were three parallel tables of ten fields; six of those
 * fields separated two of the three by 7–17%, under this file's own threshold for a difference
 * meaning anything — a luminance JND of 6.48–11.30 ΔL*. What is left of them is this: every number
 * appears once, where the axis that owns it is read, and the axis is declared next door in
 * `look-section.ts` for a panel to draw. See `decisions/a-look-declares-what-it-changes.md`.
 *
 * **Link opacity and width ride the mark**, and that is what the numbers said rather than a tidy
 * guess: 0.42 and 0.45 on the two dense forms against 0.28 on the legible one. A form that spends
 * more ink on points cannot also spend it on edges.
 *
 * **The legible mark's radius is the whole reason that mark exists.** Its floor protects the other
 * two channels from shape rather than shape from smallness, which is why it is the one to pair
 * `symbol` with: spending shape on identity *and* size on degree at once is what Giovannangeli et
 * al. (arXiv 2103.06084) measure as dropping performance drastically under even minor heterogeneity,
 * and smaller marks worsen it both ways — the luminance JND above, and a square reported larger than
 * any other shape at equal area in 82% of trials (Smart & Szafir, CHI 2019). Not "a triangle and a
 * square are the same dot below four pixels", which is what this said for months and is false; see
 * `SHAPE_ORDER` for the measurement that refutes it.
 *
 * **The values are strings because a contributed preference is a string**, in all three kinds, so an
 * unrecognised namespace rides through a write untouched. Parsing what a kind means is the reader's
 * job and it is two lines; `@kanzo-tech/theme` exports the same two, and importing them would add a
 * dependency to this package to carry no code — the same call `LOOK_SECTION` already makes about the
 * manifest type.
 *
 * A key that is missing, or that carries a value the section never offered, takes the manifest's
 * default. Those defaults are what a graph drew before any of this existed.
 */
export function lookFrom(values: Readonly<Record<string, string | undefined>> = {}): Look {
  const on = (key: string, fallback: boolean) => {
    const value = values[key];
    return value === undefined ? fallback : value === "true";
  };
  const legible = values.marks === "legible";
  const labels = Number.parseFloat(values.labels ?? "");
  return {
    size: legible ? [4, 13] : [2, 8],
    link: {
      opacity: legible ? 0.28 : 0.42,
      width: legible ? 0.5 : 0.6,
      // A hint, and `obligations.ts` says why: every link bows the same way, so cosmos.gl's default
      // of 0.5 reads as one pinwheel. A toggle rather than a range because a reader wants two
      // pictures — straight, and told apart — not a number to tune.
      curve: on("bowed-links", true) ? 0.12 : 0,
      blend: on("additive-links", false),
      // Shared by every form. It was three ranges within ±10% of each other, which is the
      // definition of a field nobody chose.
      fade: [200, 1400],
    },
    labels: Number.isFinite(labels) ? labels : 26,
    vignette: on("vignette", false),
  };
}

/** What a canvas draws when nobody has chosen anything. */
export const DEFAULT_LOOK: Look = lookFrom();

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
