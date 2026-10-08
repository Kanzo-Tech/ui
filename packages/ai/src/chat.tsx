"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { getToolName, isToolUIPart, type UIMessage } from "@kanzo-tech/llm";
import type { UseChatHelpers } from "@ai-sdk/react";
import { cn, DiagnosticList, Problem, type ProblemProps, Skeleton } from "@kanzo-tech/ui";
import type { Proposal } from "./engine.js";
import { PILLS, ProposalStrip } from "./proposal-strip.js";
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
 * How a host draws its own tools, by tool name. Each gets the call's part — typed, when the host's
 * messages are (`InferAgentUIMessage<typeof agent>`) — at **every** state, and what it returns is
 * drawn inside the tool's frame in place of its input and output: the statement as it is written,
 * a result card, a chart, an action that takes the result somewhere. A renderer that only wants the
 * result switches on `part.state`.
 *
 * `stopped` is true when the call will never settle: the reader pressed Stop, or a kept transcript
 * was cut mid-call. The AI SDK leaves such a part at the state it reached, so it is derived here.
 */
export type ChatToolRenderers = Record<string, (part: ToolPart, call: { stopped: boolean }) => React.ReactNode>;

/**
 * What `Chat` reads from `useAgentChat` or `useChat` — the helpers, not the hook, so any chat state
 * can drive it. `error` is whatever stopped the answer: `useAgentChat`'s thrown value, or
 * `useChat`'s `Error`.
 */
type ChatState<M extends UIMessage> = Pick<UseChatHelpers<M>, "messages" | "status" | "sendMessage" | "stop" | "regenerate"> & {
  error: unknown;
};

export interface ChatProps<M extends UIMessage> {
  /** `useChat(...)`'s return. */
  chat: ChatState<M>;
  tools?: ChatToolRenderers;
  /** What the panel says before the first question. */
  empty?: React.ReactNode;
  /**
   * Questions to start from, while the conversation is empty — `suggest()`'s offers, in a strip just
   * above the composer. Pressing one asks it. Passing it at all, even empty, holds the strip's row.
   */
  suggestions?: readonly Proposal[];
  /**
   * More questions are on their way — `suggest()` is still streaming them. Drawn as pills in
   * skeleton beside the ones that arrived, as many as make up the strip.
   */
  suggesting?: boolean;
  /**
   * Words in place of the pills when there are none — suggesting failed, or found nothing — as
   * `ProposalStrip` takes them. The host's to word: a failure as its `Problem`, with a retry.
   */
  notice?: React.ReactNode;
  /**
   * What the next question will be asked over, shown in the composer beside Send — the reader's
   * selection as a pill, the way Copilot Chat and Cursor show the context a prompt carries. Read-only:
   * it changes where the selection is made, never here.
   */
  context?: React.ReactNode;
  /** The host's words for a failure's code, as `Problem` takes them. */
  copy?: ProblemProps["copy"];
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
  const { chat, tools = {}, empty, suggestions, suggesting = false, notice, context, copy, translations, className } = props;
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
            {context}
            <PromptInputSubmit status={chat.status} />
          </PromptInputToolbar>
        </PromptInput>
      }
      slot="chat"
      strip={
        chat.messages.length === 0 &&
        (suggestions !== undefined || suggesting) && (
          <ProposalStrip
            className="justify-center"
            notice={notice}
            onSelect={ask}
            pending={suggesting ? PILLS - (suggestions?.length ?? 0) : 0}
            proposals={suggestions ?? []}
          />
        )
      }
    >
      {chat.messages.length === 0 ? (
        <ChatOpening empty={empty} />
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
                    const stopped = !streaming && RUNNING.has(part.state);
                    return (
                      <Tool key={key} part={part} stopped={stopped}>
                        <ToolHeader />
                        <ToolContent>
                          {draw ? (
                            draw(part, { stopped })
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
      {chat.error !== undefined && (
        // Through `Problem`, as every failure in the library is drawn: a coded one shows its code and
        // takes the host's `copy`. The live region says what the list is.
        <div data-slot="chat-error" role="alert">
          <span className="sr-only">{t.failed}</span>
          <DiagnosticList>
            <Problem copy={copy} error={chat.error} />
          </DiagnosticList>
        </div>
      )}
    </ChatFrame>
  );
}

/** The states of a call still working; one left in them once the answer stopped never settles. */
const RUNNING = new Set<ToolPart["state"]>(["input-streaming", "input-available", "approval-responded"]);

interface ChatFrameProps extends React.ComponentProps<typeof ark.div> {
  /** Between the transcript and the composer: the questions to start from, while there are any. */
  strip?: React.ReactNode;
  /** Below the transcript: the composer, live or inert. */
  composer: React.ReactNode;
}

/**
 * The one layout `Chat` and `ChatSkeleton` share, so the skeleton cannot drift from what replaces
 * it: the scrolling transcript (padding, width and pin are `ConversationContent`'s), then the
 * strip of questions to start from, then the composer. It fills its container whether that is a
 * flex column (`flex-1`) or a block with a height (`h-full`), so a host does not have to wrap the
 * two the same way for them to match.
 */
function ChatFrame(props: ChatFrameProps) {
  const { strip, composer, children, className, slot, ...rest } = props;
  return (
    <ark.div className={cn("flex h-full min-h-0 flex-1 flex-col gap-3", className)} {...rest} data-slot={slot}>
      <Conversation>
        <ConversationContent>{children}</ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {strip}
      {composer}
    </ark.div>
  );
}

/** What an empty conversation shows, centred in the panel: the host's empty state. */
function ChatOpening({ empty }: { empty: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-slot="chat-empty">
      {empty}
    </div>
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
      strip={suggestions > 0 && <ProposalStrip className="justify-center" pending={suggestions} proposals={[]} />}
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
      />
    </ChatFrame>
  );
}
