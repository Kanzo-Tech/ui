/**
 * The failures the graph names itself: no GPU device to draw with, or the one it had was taken back;
 * a device that holds no positions for the points it was given; a graph with no vertex to draw. A
 * graph `attachGraph` will not read never gets here: it refuses it, coded. `data.after` is set when a deadline fired. Everything else reaches `onFailure` as thrown.
 */
export class GraphError extends Error {
  override readonly name = "GraphError";
  constructor(
    readonly code: "graph/no-webgl" | "graph/context-lost" | "graph/no-positions" | "graph/nothing-to-draw",
    message: string,
    readonly data: { readonly after?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
