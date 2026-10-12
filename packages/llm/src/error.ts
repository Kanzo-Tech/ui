/**
 * The failure this package names: the model cannot answer here (`ai/unavailable`) — today, a page
 * whose browser has no WebGPU for `localModel`. `data.reason` says which way it cannot.
 */
export class AiError extends Error {
  override readonly name = "AiError";
  constructor(
    readonly code: "ai/unavailable",
    message: string,
    readonly data: { readonly reason?: string } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
