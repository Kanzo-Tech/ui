/**
 * **What a canvas knows and the DOM does not**, reached through a global only a test defines.
 * `GraphCanvas` and `ChartRoot` register themselves here when they find it on `window`, and do
 * nothing otherwise, so production never has it. React DevTools' `__REACT_DEVTOOLS_GLOBAL_HOOK__` is
 * the shape: the tool defines the global, the library registers with it.
 *
 * The type is declared once, here, because this package is what installs it: `@kanzo-tech/ui` and
 * `@kanzo-tech/graph` import it as a type from a devDependency, and it never reaches their emitted
 * declarations.
 */
export interface KanzoTestingHook {
  /** By the canvas element's `id`. Both answers are in pixels from the canvas's top-left corner. */
  graphs: Map<string, GraphProbe>;
  /** By the chart's accessible name, its `aria-label`. */
  charts: Map<string, ChartProbe>;
}

export interface GraphProbe {
  /** Where a vertex is drawn now, read from cosmos.gl's own space-to-screen conversion. */
  screenOf(vertex: number): [number, number];
  /** Where a point in the data's `x`/`y` is drawn now; a layout that binds neither is its space. */
  screenAt(point: { x: number; y: number }): [number, number];
}

export interface ChartProbe {
  /** Observable Plot's own `figure.scale(channel)`, in the plot's SVG pixels. */
  scale(channel: "x" | "y" | "color"): { apply(value: unknown): number; invert?(pixel: number): unknown };
}

/**
 * Defines the hook on the page it runs in, once. **Self-contained on purpose**: Playwright sends it
 * to the page as source text through `addInitScript`, so it may close over nothing.
 */
export function install(): void {
  const scope = globalThis as { __KANZO_TESTING__?: KanzoTestingHook };
  scope.__KANZO_TESTING__ ??= { graphs: new Map(), charts: new Map() };
}
