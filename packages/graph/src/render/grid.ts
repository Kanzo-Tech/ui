// The reference grid: dots at a lattice of the graph's own space, drawn on a canvas under the points.
//
// Pure arithmetic and one draw call, so the cost is a number a test can count. `overlays.ts` owns
// when it runs (once a frame, and only when the view moved); this file owns where the dots are.

/** The fewest CSS pixels between two dots. The ladder keeps the on-screen step in [MIN, 2.5·MIN). */
export const GRID_MIN = 22;

/** A dot's width in CSS pixels. A one-pixel radius was a sub-pixel stipple at 1×. */
export const DOT = 2;

/**
 * **The world distance between dots, on a 1-2-5 ladder** — the smallest 1, 2 or 5 times a power of
 * ten whose on-screen step (`pxPerUnit` pixels a world unit) is at least `min`. Zooming in subdivides
 * (5 → 2 → 1 → 0.5), zooming out merges, and the step on screen never leaves [min, 2.5·min): so the
 * lattice is a reference plane that belongs to the graph, with round numbers where a reader counts.
 * `0` when the camera has no scale to say, which draws nothing.
 */
export function spacing(pxPerUnit: number, min: number = GRID_MIN): number {
  if (!(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) return 0;
  const need = min / pxPerUnit;
  const decade = 10 ** Math.floor(Math.log10(need));
  // The epsilon keeps `need` an exact rung (0.2 → 2·10⁻¹) from rounding up past it.
  const mantissa = need / decade;
  return decade * (mantissa <= 1 + 1e-9 ? 1 : mantissa <= 2 + 1e-9 ? 2 : mantissa <= 5 + 1e-9 ? 5 : 10);
}

/** What the draw needs to know about the view: where world (0, 0) is on screen, and how big a unit is. */
export interface GridView {
  /** CSS pixels from the canvas's top-left to world (0, 0). */
  x: number;
  y: number;
  /** CSS pixels per world unit. */
  scale: number;
  /** The canvas's CSS size. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel. */
  ratio: number;
}

/** Where the lattice starts in a view and how far apart its dots are, in CSS pixels; `null` when there is none to draw. */
function lattice(view: GridView): { step: number; x: number; y: number } | null {
  const step = spacing(view.scale) * view.scale;
  if (!(step > 0)) return null;
  const first = (origin: number) => origin - Math.floor(origin / step) * step;
  return { step, x: first(view.x), y: first(view.y) };
}

/** The dots' centres in CSS pixels, in reading order — the lattice `drawGrid` fills, apart from the canvas. */
export function* dots(view: GridView): Generator<[number, number]> {
  const found = lattice(view);
  if (!found) return;
  for (let y = found.y; y < view.height; y += found.step) {
    for (let x = found.x; x < view.width; x += found.step) yield [x, y];
  }
}

/** A dot's side in device pixels: whole, so it is the same shape wherever it lands and never a faint blur. */
export const side = (ratio: number): number => Math.max(2, Math.round(DOT * ratio));

/**
 * Clear the canvas and fill the dots in `ink`, each a square of whole device pixels snapped to the
 * device grid. A square, not an arc: it is one rectangle fill with no edge to antialias, which is the
 * difference between the cheapest draw a canvas has and a path of a thousand circles — and at two
 * device pixels across the two cannot be told apart. Snapping makes every dot the same and has the
 * lattice step a pixel at a time when it pans, instead of shimmering.
 */
export function drawGrid(context: CanvasRenderingContext2D, view: GridView, ink: string): void {
  const { ratio } = view;
  context.clearRect(0, 0, view.width * ratio, view.height * ratio);
  const found = lattice(view);
  if (!found) return;
  context.fillStyle = ink;
  const size = side(ratio);
  for (let y = found.y; y < view.height; y += found.step) {
    for (let x = found.x; x < view.width; x += found.step) {
      context.fillRect(Math.round(x * ratio - size / 2), Math.round(y * ratio - size / 2), size, size);
    }
  }
}
