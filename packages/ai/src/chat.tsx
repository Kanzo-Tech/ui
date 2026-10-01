"use client";

import * as React from "react";
import { getToolName, isToolUIPart, type UIMessage } from "@kanzo-tech/llm";
import type { UseChatHelpers } from "@ai-sdk/react";
import { cn, Suggestion, Suggestions } from "@kanzo-tech/ui";
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
 * host's messages are (`InferAgentUIMessage<typeof agent>`) — and draws inside the tool's frame,
 * under its input: a result table, a chart, an action that takes the result somewhere.
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
  /** Questions to start from, while the conversation is empty. Pressing one asks it. */
  suggestions?: string[];
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
  const { chat, tools = {}, empty, suggestions, translations, className } = props;
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
              {suggestions && suggestions.length > 0 && (
                <Suggestions className="justify-center">
                  {suggestions.map((s) => (
                    <Suggestion key={s} onSelect={ask} value={s}>
                      {s}
                    </Suggestion>
                  ))}
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
                              <ToolInput />
                              {draw && part.state === "output-available" ? draw(part) : <ToolOutput />}
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
