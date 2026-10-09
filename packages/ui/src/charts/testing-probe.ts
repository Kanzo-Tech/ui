import type { ChartProbe, KanzoTestingHook } from "@kanzo-tech/testing";

/** What Observable Plot returns — an SVG, or a figure around one — with its scales on it. */
export type PlotOutput = Element & { scale(channel: string): ReturnType<ChartProbe["scale"]> };

/**
 * **Registers a chart with `@kanzo-tech/testing`'s hook, under its title, when a test installed
 * one**, and does nothing otherwise: production never defines `window.__KANZO_TESTING__`. The scale
 * it answers with is Plot's own `figure.scale(channel)`, read from the output on screen when it is
 * asked, so a harness brushes *125°W to 100°W* through the same scale the axis was drawn with. A
 * chart with no title is not one a harness can name, and is not registered.
 */
export function registerChartForTesting(title: string | undefined, output: () => PlotOutput | null): () => void {
  const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
  if (!hook || !title) return () => {};
  const probe: ChartProbe = {
    scale(channel) {
      const drawn = output();
      if (!drawn) throw new Error(`the chart "${title}" has not drawn`);
      return drawn.scale(channel);
    },
  };
  hook.charts.set(title, probe);
  return () => {
    if (hook.charts.get(title) === probe) hook.charts.delete(title);
  };
}
