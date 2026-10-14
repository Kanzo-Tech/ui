/**
 * What the examples and showcases read of a call to their model, which is `@kanzo-tech/llm/testing`'s
 * double — the AI SDK's own mock answering from a script — so `Assist` and `Chat` run the real
 * conversation with nothing on the other end of a network. Swap it for `localModel(…)` and nothing
 * else on the page changes; that is the claim the examples make, so they are built on nothing a real
 * model would not do.
 */
import type { ModelCall } from "@kanzo-tech/llm/testing";

/**
 * How fast the double writes on these pages: a test wants the answer at once, and a reader has to see
 * it arrive to see that it streams.
 */
export const PACE = { perWord: 40 } as const;

/** The last thing the person asked. */
export const askOf = (call: ModelCall): string => {
  const user = call.prompt.filter((m) => m.role === "user").at(-1);
  if (!user || typeof user.content === "string") return "";
  return user.content.map((p) => ("text" in p ? p.text : "")).join("");
};

/** True when this call follows a tool's result — the step where an agent answers. */
export const afterTool = (call: ModelCall) => call.prompt.at(-1)?.role === "tool";
