/**
 * The failures this package names: the model cannot answer here (`llm/unavailable`) — for `localModel`,
 * a browser with no WebGPU (`data.reason` `"webgpu"`) or a page that serves no such model
 * (`"unserved"`), `data.reason` saying which way it cannot — and the model answered and was cut off
 * (`llm/truncated`): a structured answer that did not fit the model's context, so what it wrote is
 * not an answer and is not handed on. A generation stopped from outside is not one of these: it
 * rejects as an `AbortError`, as an aborted `fetch` does. One class per
 * package, named for it, in the `area/kind` grammar every code here uses (`/docs/design/failure`).
 */
export class LlmError extends Error {
  override readonly name = "LlmError";
  constructor(
    readonly code: "llm/unavailable" | "llm/truncated",
    message: string,
    readonly data: { readonly reason?: string } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
