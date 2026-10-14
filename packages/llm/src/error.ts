/**
 * The failure this package names: the model cannot answer here (`llm/unavailable`) — today, a page
 * whose browser has no WebGPU for `localModel`. `data.reason` says which way it cannot. One class per
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
