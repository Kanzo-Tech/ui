"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { getToolName, isToolUIPart, type UIMessage } from "@kanzo-tech/llm";
import type { UseChatHelpers } from "@ai-sdk/react";
import { cn, Skeleton, Suggestion, Suggestions } from "@kanzo-tech/ui";
import type { Proposal } from "./engine.js";
import { Conversation, ConversationContent, ConversationScrollButton } from "./conversation.js";
import { MessageMarkdown } from "./markdown.js";
import { Message, MessageContent, MessageList } from "./message.js";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "./prompt-input.js";
import { Reasoning } from "./reasoning.js";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolPart } from "./tool.js";

/** Every word `Chat` draws. English by default. */
export interface ChatTranslations {
  /** The composer's placeholder. */
  placeholder: string;
  /** Announced to a screen reader with the error that stopped an answer. */
  failed: string;
}

const ENGLISH: ChatTranslations = {
  placeholder: "Ask anything…",
  failed: "The answer stopped:",
};

/**
 * How a host draws its own tools' results, by tool name. Each gets the call's part — typed, when the
 * host's messages are (`InferAgentUIMessage<typeof agent>`) — and draws inside the tool's frame once
 * the call has a result, in place of its input and output: a result card, a chart, an action that
 * takes the result somewhere. Until then the frame shows the input, so the reader sees what is
 * running.
 */
export type ChatToolRenderers = Record<string, (part: ToolPart) => React.ReactNode>;

/** What `Chat` reads from `useChat` — the helpers, not the hook, so any chat state can drive it. */
type ChatState<M extends UIMessage> = Pick<
  UseChatHelpers<M>,
  "messages" | "status" | "error" | "sendMessage" | "stop" | "regenerate"
>;

export interface ChatProps<M extends UIMessage> {
  /** `useChat(...)`'s return. */
  chat: ChatState<M>;
  tools?: ChatToolRenderers;
  /** What the panel says before the first question. */
  empty?: React.ReactNode;
  /** Questions to start from, while the conversation is empty — `suggest()`'s offers. Pressing one asks it. */
  suggestions?: readonly Proposal[];
  /**
   * More questions are on their way — `suggest()` is still streaming them. Drawn as pills in
   * skeleton beside the ones that arrived; a host whose suggesting failed passes `false` and no
   * pills, and the conversation works the same without them.
   */
  suggesting?: boolean;
  translations?: Partial<ChatTranslations>;
  className?: string;
}

/**
 * A conversation with a model, whole: the transcript, the model's reasoning and calls as they
 * happen, markdown that streams, and a composer that sends, stops and retries. A host brings the
 * chat (`useChat`) and draws its own tools' results; everything else is here.
 *
 * Each part is drawn from the AI SDK's own message parts, so nothing is translated on the way in:
 * text as markdown, `reasoning` folded away, every tool call in its frame with the SDK's state.
 */
export function Chat<M extends UIMessage>(props: ChatProps<M>) {
  const { chat, tools = {}, empty, suggestions = [], suggesting = false, translations, className } = props;
  const t = { ...ENGLISH, ...translations };
  const [draft, setDraft] = React.useState("");
  const busy = chat.status === "submitted" || chat.status === "streaming";
  const last = chat.messages.at(-1);

  const ask = (text: string) => {
    if (!text.trim()) return;
    void chat.sendMessage({ text });
    setDraft("");
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)} data-slot="chat">
      <Conversation>
        <ConversationContent>
          {chat.messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-slot="chat-empty">
              {empty}
              {(suggestions.length > 0 || suggesting) && (
                <Suggestions aria-busy={suggesting || undefined} className="w-full justify-center">
                  {suggestions.map((s) => (
                    <Suggestion key={s.text} onSelect={ask} value={s.text}>
                      {s.text}
                    </Suggestion>
                  ))}
                  {suggesting && <PillSkeletons count={Math.max(1, PILLS - suggestions.length)} />}
                </Suggestions>
              )}
            </div>
          ) : (
            <MessageList>
              {chat.messages.map((m) => (
                <Message key={m.id} role={m.role}>
                  <MessageContent>
                    {m.parts.map((part, i) => {
                      const key = `${m.id}-${i}`;
                      const streaming = busy && m === last;
                      if (part.type === "text") {
                        return m.role === "user" ? (
                          <p className="whitespace-pre-wrap break-words" key={key}>
                            {part.text}
                          </p>
                        ) : (
                          <MessageMarkdown key={key} streaming={streaming && part.state === "streaming"}>
                            {part.text}
                          </MessageMarkdown>
                        );
                      }
                      if (part.type === "reasoning") return <Reasoning key={key} part={part} />;
                      if (isToolUIPart(part)) {
                        const draw = tools[getToolName(part)];
                        return (
                          <Tool key={key} part={part}>
                            <ToolHeader />
                            <ToolContent>
                              {draw && part.state === "output-available" ? (
                                draw(part)
                              ) : (
                                <>
                                  <ToolInput />
                                  <ToolOutput />
                                </>
                              )}
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
            </MessageList>
          )}
          {chat.error && (
            <p className="text-destructive-foreground text-sm" data-slot="chat-error" role="alert">
              <span className="sr-only">{t.failed} </span>
              {chat.error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) void chat.stop();
          else if (chat.status === "error" && !draft.trim()) void chat.regenerate();
          else ask(draft);
        }}
      >
        <PromptInputTextarea
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.placeholder}
          value={draft}
        />
        <PromptInputToolbar>
          <PromptInputSubmit status={chat.status} />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

/** How many pills a strip of suggestions holds while it is still arriving. */
const PILLS = 3;
const PILL_WIDTHS = ["w-44", "w-36", "w-52", "w-40"];

/** Pills not yet written, the size of a `Suggestion`: the strip keeps its height as they land. */
function PillSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <Skeleton className={cn("h-7 max-w-full rounded-full", PILL_WIDTHS[i % PILL_WIDTHS.length])} key={i} />
  ));
}

export interface ChatSkeletonProps extends React.ComponentProps<typeof ark.div> {
  /** The same `empty` the `Chat` will be given; a placeholder of its size when omitted. */
  empty?: React.ReactNode;
  /** How many pills to hold room for. `0` for a chat that offers none. */
  suggestions?: number;
  translations?: Partial<Pick<ChatTranslations, "placeholder">>;
}

/**
 * `Chat` before it can be drawn — the schema still loading, the agent not yet built — in `Chat`'s
 * own layout: the empty state, the pills in skeleton, and the composer, inert. The composer is the
 * real one rather than a block of its size, so the two cannot drift apart and nothing jumps when
 * the chat replaces it.
 */
export function ChatSkeleton(props: ChatSkeletonProps) {
  const { empty, suggestions = PILLS, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  return (
    <ark.div
      aria-busy
      className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}
      {...rest}
      data-slot={slot ?? "chat-skeleton"}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4">
          {empty ?? (
            <>
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </>
          )}
          {suggestions > 0 && (
            <Suggestions className="w-full justify-center">
              <PillSkeletons count={suggestions} />
            </Suggestions>
          )}
        </div>
      </div>
      <PromptInput inert>
        <PromptInputTextarea disabled placeholder={t.placeholder} />
        <PromptInputToolbar>
          <PromptInputSubmit disabled />
        </PromptInputToolbar>
      </PromptInput>
    </ark.div>
  );
}
