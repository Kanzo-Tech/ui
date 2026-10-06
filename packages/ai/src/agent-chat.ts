"use client";

import { type UseChatHelpers, type UseChatOptions, useChat } from "@ai-sdk/react";
import { type Agent, DirectChatTransport, type InferAgentUIMessage, type ToolSet, type UIMessage } from "@kanzo-tech/llm";
import * as React from "react";

/** `useChat`'s helpers, with `error` the value the agent threw rather than a sentence about it. */
export type AgentChat<M extends UIMessage> = Omit<UseChatHelpers<M>, "error"> & {
  /** What stopped the last answer, whole: an `AiError` with its `code` and `data`, a refusal, anything. */
  error: unknown;
};

/** `useChat`'s options, less the transport: it is the agent's. */
export type AgentChatOptions<M extends UIMessage> = Omit<Extract<UseChatOptions<M>, { transport?: unknown }>, "transport">;

/**
 * A conversation with an agent that runs in the page — `useChat` over the AI SDK's
 * `DirectChatTransport` — that keeps what the agent threw.
 *
 * `useChat` hands back a sentence: the transport writes the failure into the stream as text and the
 * chat rebuilds an `Error` from it, so an `AiError`'s `code` and `data` are gone by the time a host
 * could branch on them. This keeps the value the transport was given and answers it as `error`, the
 * same value every other surface in the library hands over (`/docs/design/failure`).
 *
 * The agent is the first render's, as `useChat` keeps the first transport: a host whose agent waits
 * on something (a schema) draws `ChatSkeleton` until it can build it.
 */
export function useAgentChat<TOOLS extends ToolSet>(
  agent: Agent<never, TOOLS>,
  options?: AgentChatOptions<InferAgentUIMessage<Agent<never, TOOLS>>>,
): AgentChat<InferAgentUIMessage<Agent<never, TOOLS>>> {
  type M = InferAgentUIMessage<Agent<never, TOOLS>>;
  // The thrown value beside the words the chat will rebuild from it, so an error the chat holds is
  // matched to the value it came from and never to an earlier one.
  const thrown = React.useRef<{ value: unknown; text: string } | null>(null);
  const [transport] = React.useState(
    () =>
      new DirectChatTransport({
        agent,
        onError: (value) => {
          const text = value instanceof Error ? value.message : String(value);
          thrown.current = { value, text };
          return text;
        },
      }),
  );
  const chat = useChat<M>({ ...options, transport });
  const error =
    chat.error === undefined
      ? undefined
      : thrown.current !== null && thrown.current.text === chat.error.message
        ? thrown.current.value
        : chat.error;
  return { ...chat, error };
}
