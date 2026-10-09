import { type LanguageModel, type OutputInterface, type StreamTextResult, type ToolSet, streamText } from "ai";

export interface StreamOptions<OUTPUT extends OutputInterface> {
  /** A model behind the gateway — `gateway("complete")`. */
  model: LanguageModel;
  /** What the answer is for: the system prompt. */
  system?: string;
  prompt: string;
  /** `Output.array(…)` or `Output.object(…)` for a structured answer; plain text when omitted. */
  output?: OUTPUT;
  abortSignal?: AbortSignal;
}

/** One answer, read as text, as an array's elements or as a growing object, and each throws what stopped it. */
export interface Stream<OUTPUT extends OutputInterface> {
  readonly text: AsyncIterable<string>;
  readonly elements: StreamTextResult<ToolSet, never, OUTPUT>["elementStream"] extends AsyncIterable<infer E>
    ? AsyncIterable<E>
    : never;
  readonly partial: StreamTextResult<ToolSet, never, OUTPUT>["partialOutputStream"] extends AsyncIterable<infer P>
    ? AsyncIterable<P>
    : never;
}

/**
 * **The one door to a model's answer** — `streamText`, with the two things every caller here needs
 * and the SDK does not do:
 *
 * - **A failure throws, once the stream ends.** The SDK reports a failed stream to `onError` and then
 *   ends it as if it had finished, so a refused call would read as a model with nothing to say. Each
 *   reading below rethrows what was reported, whole: a silent model as its `AiError` coded
 *   `ai/silent`, a refusal as its `AiError` coded `ai/rate-limited` or `ai/unavailable`.
 * - **Never retried.** The gateway retries its upstreams, and a silent gateway asked three times is
 *   three deadlines where the person waits for one.
 *
 * Read one of `text`, `elements` or `partial`, once: they are views of the same stream.
 */
export function stream<OUTPUT extends OutputInterface = OutputInterface<string, string, never>>(
  options: StreamOptions<OUTPUT>,
): Stream<OUTPUT> {
  let failed: { error: unknown } | undefined;
  const result = streamText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    output: options.output,
    abortSignal: options.abortSignal,
    maxRetries: 0,
    onError: ({ error }) => void (failed ??= { error }),
  });
  async function* rethrowing<T>(source: AsyncIterable<T>): AsyncIterable<T> {
    yield* source;
    if (failed) throw failed.error;
  }
  return {
    get text() {
      return rethrowing(result.textStream);
    },
    get elements() {
      return rethrowing(result.elementStream) as Stream<OUTPUT>["elements"];
    },
    get partial() {
      return rethrowing(result.partialOutputStream) as Stream<OUTPUT>["partial"];
    },
  };
}
