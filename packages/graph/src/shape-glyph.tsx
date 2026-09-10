import { SHAPE_PATH, type Shape } from "./graph-looks";

/**
 * The glyph the canvas draws for a category, in the DOM — a legend key, a hover card, a preview.
 *
 * **This replaced `SHAPE_PATH` on the barrel, and the difference is what a host is made responsible
 * for.** The path table was exported for one reason: a host drawing a legend wanted the same glyph
 * the point shader fills, because a legend drawn from a second set of shapes is a legend that
 * explains a picture nobody is looking at. What the host got was path *data*, and with it three
 * facts it had to keep in step with `graph-looks.ts` by reading a comment — that the box is twelve
 * units, that the path wants a `fill` rather than a `stroke`, and which enum index each glyph is
 * keyed by. Every one of those was silent when it drifted.
 *
 * A component carries all three and cannot disagree with itself. What is left at the call site is
 * the only thing the host actually decides: how big, and what colour.
 *
 * **No `"use client"`, deliberately.** It is a function of its props with no state, no effect and no
 * event handler, so it renders on a server the way any other markup does. The rest of this package
 * is client-only because a WebGL context is; a `<path>` is not.
 */
export interface ShapeGlyphProps extends React.SVGProps<SVGSVGElement> {
  /** Which glyph — the name `scaleOf(...).shape(ordinal)` answers with. */
  shape: Shape;
  /**
   * What to fill it with. Defaults to `currentColor`, so a glyph inside a legend row inherits the
   * row's colour and a host that is colouring by category passes `scaleOf(...).color(ordinal)`.
   */
  color?: string;
}

export function ShapeGlyph({ color = "currentColor", shape, ...rest }: ShapeGlyphProps) {
  return (
    // The `viewBox` is the glyph's own box and is not a prop: the paths are authored inside a 12×12
    // square, which is the fact the host used to have to know. Size it from outside — a `className`,
    // a `width`/`height`, or `x`/`y`/`width`/`height` when this is nested inside another `<svg>`,
    // which is how a preview places a glyph at a vertex.
    <svg viewBox="0 0 12 12" {...rest}>
      <path d={SHAPE_PATH[shape]} fill={color} />
    </svg>
  );
}
