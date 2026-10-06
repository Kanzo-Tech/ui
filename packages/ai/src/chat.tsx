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
  /**
   * Questions to start from, while the conversation is empty — `suggest()`'s offers. Pressing one
   * asks it. Passing it at all, even empty, holds the strip's row: a host whose suggesting failed
   * passes `[]`, and the empty state stays where it was.
   */
  suggestions?: readonly Proposal[];
  /**
   * More questions are on their way — `suggest()` is still streaming them. Drawn as pills in
   * skeleton beside the ones that arrived, as many as make up the strip.
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
  const { chat, tools = {}, empty, suggestions, suggesting = false, translations, className } = props;
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
    <ChatFrame
      className={className}
      composer={
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
      }
      slot="chat"
    >
      {chat.messages.length === 0 ? (
        <ChatOpening empty={empty}>
          {(suggestions !== undefined || suggesting) && (
            <PillRow busy={suggesting} pending={suggesting ? PILLS - (suggestions?.length ?? 0) : 0}>
              {suggestions?.map((s) => (
                <Suggestion key={s.text} onSelect={ask} value={s.text}>
                  {s.text}
                </Suggestion>
              ))}
            </PillRow>
          )}
        </ChatOpening>
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
    </ChatFrame>
  );
}

/** How many pills a strip of suggestions holds while it is still arriving. */
const PILLS = 3;
const PILL_WIDTHS = ["w-44", "w-36", "w-52", "w-40"];

interface ChatFrameProps extends React.ComponentProps<typeof ark.div> {
  /** Below the transcript: the composer, live or inert. */
  composer: React.ReactNode;
}

/**
 * The one layout `Chat` and `ChatSkeleton` share, so the skeleton cannot drift from what replaces
 * it: the scrolling transcript (padding, width and pin are `ConversationContent`'s), then the
 * composer. It fills its container whether that is a flex column (`flex-1`) or a block with a
 * height (`h-full`), so a host does not have to wrap the two the same way for them to match.
 */
function ChatFrame(props: ChatFrameProps) {
  const { composer, children, className, slot, ...rest } = props;
  return (
    <ark.div className={cn("flex h-full min-h-0 flex-1 flex-col gap-3", className)} {...rest} data-slot={slot}>
      <Conversation>
        <ConversationContent>{children}</ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {composer}
    </ark.div>
  );
}

/** What an empty conversation shows, centred in the panel: the host's empty state, then the strip. */
function ChatOpening({ empty, children }: { empty: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-slot="chat-empty">
      {empty}
      {children}
    </div>
  );
}

/**
 * The strip of questions, one pill high even when it holds none: arriving, failed or answered, the
 * empty state above it never moves. `pending` pills in skeleton stand for the ones still coming.
 */
function PillRow({ busy, pending, children }: { busy: boolean; pending: number; children?: React.ReactNode }) {
  return (
    <Suggestions aria-busy={busy || undefined} className="min-h-7 w-full justify-center">
      {children}
      {Array.from({ length: Math.max(0, pending) }, (_, i) => (
        <Skeleton className={cn("h-7 max-w-full rounded-full", PILL_WIDTHS[i % PILL_WIDTHS.length])} key={i} />
      ))}
    </Suggestions>
  );
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
  const { empty, suggestions = PILLS, translations, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  return (
    <ChatFrame
      aria-busy
      composer={
        <PromptInput inert>
          <PromptInputTextarea disabled placeholder={t.placeholder} />
          <PromptInputToolbar>
            <PromptInputSubmit disabled />
          </PromptInputToolbar>
        </PromptInput>
      }
      {...rest}
      slot={slot ?? "chat-skeleton"}
    >
      <ChatOpening
        empty={
          empty ?? (
            <>
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </>
          )
        }
      >
        {suggestions > 0 && <PillRow busy pending={suggestions} />}
      </ChatOpening>
    </ChatFrame>
  );
}
