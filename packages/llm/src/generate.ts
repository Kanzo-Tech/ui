import { type InferGenerateOutput, type OutputInterface, generateText } from "ai";
import type { StreamOptions } from "./stream.js";

export interface GenerateOptions<OUTPUT extends OutputInterface> extends StreamOptions<OUTPUT> {
  /** Passed to the provider as they are: `{ kanzo: { grammar } }` is what `localModel` reads. */
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}

/** One answer, whole: its text, and its `output` when one was asked for. */
export interface Generated<OUTPUT extends OutputInterface> {
  readonly text: string;
  readonly output: InferGenerateOutput<OUTPUT>;
}

/**
 * **The other door to a model's answer** — `generateText`, for a caller that reads the answer whole,
 * as a Task does. Asked once, as `stream` asks: a model that failed on this device fails the same way
 * asked again, and each attempt is a whole generation the person waits through. A failure rejects
 * with what the model threw, whole.
 */
export async function generate<OUTPUT extends OutputInterface = OutputInterface<string, string, never>>(
  options: GenerateOptions<OUTPUT>,
): Promise<Generated<OUTPUT>> {
  const { text, output } = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    output: options.output,
    providerOptions: options.providerOptions,
    abortSignal: options.abortSignal,
    maxRetries: 0,
  });
  return { text, output: output as InferGenerateOutput<OUTPUT> };
}
