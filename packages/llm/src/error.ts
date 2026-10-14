/**
 * The failure this package names: the model cannot answer here (`llm/unavailable`) — for `localModel`,
 * a browser with no WebGPU (`data.reason` `"webgpu"`) or a page that serves no such model
 * (`"unserved"`). `data.reason` says which way it cannot. One class per
 * package, named for it, in the `area/kind` grammar every code here uses (`/docs/design/failure`).
 */
export class LlmError extends Error {
  override readonly name = "LlmError";
  constructor(
    readonly code: "llm/unavailable",
    message: string,
    readonly data: { readonly reason?: string } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
