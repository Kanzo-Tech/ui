/**
 * The failures the graph names itself: no GPU device to draw with, or the one it had was taken back;
 * a corpus with no vertex to draw; a crossfilter clause no vertex type can answer. A
 * corpus fossil will not read never gets here: `open` refuses it, coded. `data.after` is set when a deadline fired. Everything else reaches `onFailure` as thrown.
 */
export class GraphError extends Error {
  override readonly name = "GraphError";
  constructor(
    readonly code: "graph/no-webgl" | "graph/context-lost" | "graph/nothing-to-draw" | "graph/unfilterable",
    message: string,
    readonly data: { readonly after?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
