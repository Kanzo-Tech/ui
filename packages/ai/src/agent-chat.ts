"use client";

import { type UseChatHelpers, type UseChatOptions, useChat } from "@ai-sdk/react";
import { type Agent, DirectChatTransport, type InferAgentUIMessage, type ToolSet, type UIMessage } from "ai";
import type { ChatTransport } from "ai";
import * as React from "react";
import { useKept, type KeptChat, type KeptChatOptions } from "./kept-chat.js";

/** `useChat`'s helpers, with `error` the value the agent threw rather than a sentence about it. */
export type AgentChat<M extends UIMessage> = Omit<UseChatHelpers<M>, "error"> & {
  /** What stopped the last answer, whole: an `LlmError` with its `code` and `data`, a refusal, anything. */
  error: unknown;
  /** The chat as it is kept, when the hook was given `load` and `save`: where it stands, and its own `save`. */
  kept?: KeptChat<M>;
};

type ChatOptions<M extends UIMessage> = Omit<Extract<UseChatOptions<M>, { transport?: unknown }>, "transport">;

/**
 * `useChat`'s options, less the transport: it is the agent's. Given `load` and `save`, the chat of
 * `id` is kept: read once before the first turn, validated with `dataPartSchemas`, and saved at the
 * end of every turn through `keep` — so `messages` is not given, it is what `load` answers.
 */
export type AgentChatOptions<M extends UIMessage> =
  | (ChatOptions<M> & { load?: never; save?: never; keep?: never })
  | (Omit<ChatOptions<M>, "id" | "messages"> & KeptChatOptions<M>);

/**
 * A conversation with an agent that runs in the page — `useChat` over the AI SDK's
 * `DirectChatTransport` — that keeps what the agent threw.
 *
 * `useChat` hands back a sentence: the transport writes the failure into the stream as text and the
 * chat rebuilds an `Error` from it, so an `LlmError`'s `code` and `data` are gone by the time a host
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
  return useTransportChat((onError) => new DirectChatTransport({ agent, onError }), options, agent.tools);
}

/**
 * `useChat` over the transport `make` builds once, with the chat's `error` the value that was thrown
 * — not the words the chat rebuilt from it. `onError` is what the transport reports a failure through.
 * A kept chat's tool parts are validated against `tools`, the ones its turns call.
 */
export function useTransportChat<M extends UIMessage>(
  make: (onError: (value: unknown) => string) => ChatTransport<M>,
  options?: AgentChatOptions<M>,
  tools?: ToolSet,
): AgentChat<M> {
  // The thrown value beside the words the chat will rebuild from it, so an error the chat holds is
  // matched to the value it came from and never to an earlier one.
  const thrown = React.useRef<{ value: unknown; text: string } | null>(null);
  const [transport] = React.useState(() =>
    make((value) => {
      const text = value instanceof Error ? value.message : String(value);
      thrown.current = { value, text };
      return text;
    }),
  );
  const { load, save, keep, ...rest } = options ?? {};
  const kept = useKept<M>(
    load !== undefined && save !== undefined && rest.id !== undefined
      ? {
          id: rest.id,
          load,
          save,
          keep,
          dataPartSchemas: rest.dataPartSchemas,
          messageMetadataSchema: rest.messageMetadataSchema,
          tools: tools as never,
        }
      : undefined,
  );
  const chat = useChat<M>({
    ...rest,
    // The chat is made once it is read — `useChat` makes a new one when its `id` changes — so it
    // starts from the messages `load` answered.
    ...(kept && { id: kept.messages === undefined ? undefined : rest.id, messages: kept.messages }),
    transport,
    onFinish: (event) => {
      rest.onFinish?.(event);
      // Its failure is the chat's `kept` state; the next turn's save is tried all the same.
      if (kept) kept.save(event.messages).catch(() => undefined);
    },
  });
  const error =
    chat.error === undefined
      ? undefined
      : thrown.current !== null && thrown.current.text === chat.error.message
        ? thrown.current.value
        : chat.error;
  return { ...chat, error, ...(kept && { kept }) };
}
