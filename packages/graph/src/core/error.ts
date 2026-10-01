/**
 * The failures the graph names itself: no GPU device to draw with, or the one it had was taken back;
 * a corpus it cannot draw (not `fossil/1`, nothing positioned); a crossfilter clause it cannot ask the
 * corpus. `data.after` is set when a deadline fired. Everything else reaches `onFailure` as thrown.
 */
export class GraphError extends Error {
  override readonly name = "GraphError";
  constructor(
    readonly code: "graph/no-webgl" | "graph/context-lost" | "graph/unreadable-corpus" | "graph/untranslatable-filter",
    message: string,
    readonly data: { readonly after?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
