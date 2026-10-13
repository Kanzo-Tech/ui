"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { getToolName, isToolUIPart, type UIMessage } from "@kanzo-tech/llm";
import type { UseChatHelpers } from "@ai-sdk/react";
import { cn, DiagnosticList, Problem, type ProblemProps, Skeleton, Suggestion, Suggestions } from "@kanzo-tech/ui";
import { PILLS } from "./pills.js";
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
import type { Proposal } from "./task/index.js";
import { Working } from "./working.js";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolPart } from "./tool.js";

/** Every word `Chat` draws. English by default. */
export interface ChatTranslations {
  /** The composer's placeholder. */
  placeholder: string;
  /** Announced to a screen reader with the error that stopped an answer. */
  failed: string;
  /** Where the answer will be, from the question sent until the model's first word. */
  waiting: string;
}

const ENGLISH: ChatTranslations = {
  placeholder: "Ask anything…",
  failed: "The answer stopped:",
  waiting: "Thinking…",
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

/** A message `Chat` sends: what `sendMessage` takes — `{ text }`, or the message's `parts`. */
export type ChatMessage<M extends UIMessage> = NonNullable<Parameters<UseChatHelpers<M>["sendMessage"]>[0]>;

/**
 * Questions to start from, while the conversation is empty — a Task's offers (`propose`, or
 * `askOffers`), in a strip just above the composer, taken whole. **Pressing one sends its value, never
 * its words**, so what the Task checked is what is asked: a string as the message's text, anything
 * else as the message `message` makes of it — Ask's spec as `askEdit(spec)`, which the chat asks as
 * it is, with no model in between. The pill reads the message's text. Passing `proposals` at all,
 * even empty, holds the strip's row.
 */
export type ChatProposals<M extends UIMessage, V> =
  | { proposals?: readonly Proposal<string>[]; message?: (value: string) => ChatMessage<M> }
  | { proposals: readonly Proposal<V>[]; message: (value: V) => ChatMessage<M> };

interface ChatOwnProps<M extends UIMessage> {
  /** `useChat(...)`'s return. */
  chat: ChatState<M>;
  tools?: ChatToolRenderers;
  /** What the panel says before the first question. */
  empty?: React.ReactNode;
  /**
   * More questions are on their way. Drawn as pills in skeleton beside the ones that arrived, as
   * many as make up the strip.
   */
  proposing?: boolean;
  /**
   * Words in place of the pills when there are none — proposing failed, or found nothing — as
   * `Assist` puts in place of its candidates. The host's to word: a failure as its `Problem`, with a retry.
   */
  notice?: React.ReactNode;
  /**
   * What the next question will be asked over, shown in the composer beside Send — the reader's
   * selection as a pill, the way Copilot Chat and Cursor show the context a prompt carries. Read-only:
   * it changes where the selection is made, never here.
   */
  context?: React.ReactNode;
  /** The host's words for a failure's code, as `Problem` takes them. */
  describe?: ProblemProps["describe"];
  translations?: Partial<ChatTranslations>;
  className?: string;
}

export type ChatProps<M extends UIMessage, V = string> = ChatOwnProps<M> & ChatProposals<M, V>;

/** The words a message says — its text, or its text parts — which is what its pill reads. */
const wordsOf = <M extends UIMessage>(message: ChatMessage<M>): string =>
  "text" in message && typeof message.text === "string"
    ? message.text
    : ((message as { parts?: readonly { type: string; text?: string }[] }).parts ?? [])
        .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
        .join(" ");

/**
 * A conversation with a model, whole: the transcript, the model's reasoning and calls as they
 * happen, markdown that streams, and a composer that sends, stops and retries. A host brings the
 * chat (`useChat`) and draws its own tools' results; everything else is here.
 *
 * Each part is drawn from the AI SDK's own message parts, so nothing is translated on the way in:
 * text as markdown, `reasoning` folded away, every tool call in its frame with the SDK's state.
 */
export function Chat<M extends UIMessage, V = string>(props: ChatProps<M, V>) {
  const { chat, tools = {}, empty, proposing = false, notice, context, describe, translations, className } = props;
  // One shape for both arms: a string's message is its text, unless the host says otherwise.
  const proposals = props.proposals as readonly Proposal<unknown>[] | undefined;
  const message = (props.message ?? ((value: string) => ({ text: value }))) as (value: unknown) => ChatMessage<M>;
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
        (proposals !== undefined || proposing) && (
          <Suggestions
            className="min-h-7 w-full justify-center"
            pending={proposing ? PILLS - (proposals?.length ?? 0) : 0}
          >
            {proposals?.map((p) => {
              const sent = message(p.value);
              const words = wordsOf(sent);
              return (
                <Suggestion
                  description={p.rationale}
                  key={p.id}
                  onSelect={() => {
                    void chat.sendMessage(sent);
                    setDraft("");
                  }}
                  value={words}
                >
                  {words}
                </Suggestion>
              );
            })}
            {!proposing && !proposals?.length && notice}
          </Suggestions>
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
          {/* Sent, and nothing back yet: the answer's place, held where it will be — the busy Send
              button alone says nothing in the transcript, which is where the reader is looking. */}
          {chat.status === "submitted" && (
            <Message role="assistant" slot="chat-waiting">
              <MessageContent>
                <Working className="gap-1.5 text-xs [&>svg]:size-3.5">{t.waiting}</Working>
              </MessageContent>
            </Message>
          )}
        </MessageList>
      )}
      {chat.error !== undefined && (
        // Through `Problem`, as every failure in the library is drawn: a coded one shows its code and
        // takes the host's `describe`. The live region says what the list is.
        <div data-slot="chat-error" role="alert">
          <span className="sr-only">{t.failed}</span>
          <DiagnosticList>
            <Problem describe={describe} error={chat.error} />
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
  proposals?: number;
  translations?: Partial<Pick<ChatTranslations, "placeholder">>;
}

/**
 * `Chat` before it can be drawn — the schema still loading, the agent not yet built — in `Chat`'s
 * own layout: the empty state, the pills in skeleton, and the composer, inert. The composer is the
 * real one rather than a block of its size, so the two cannot drift apart and nothing jumps when
 * the chat replaces it.
 */
export function ChatSkeleton(props: ChatSkeletonProps) {
  const { empty, proposals = PILLS, translations, slot, ...rest } = props;
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
      strip={proposals > 0 && <Suggestions className="min-h-7 w-full justify-center" pending={proposals} />}
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
