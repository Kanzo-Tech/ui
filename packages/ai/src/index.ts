// @kanzo-tech/ai — the surfaces that know a model is on the other end. Two capabilities, one door
// each: a field the model helps fill (`AssistProvider` + `Assist`) and a conversation with one
// (`Chat`, over `useAgentChat`). The parts a conversation is drawn with are exported beside it, for a host
// that draws a transcript `Chat` does not. The model behind them is the AI SDK, reached through
// `@kanzo-tech/llm`. Asking questions of data — an agent with a SQL tool, and the card its answers
// are drawn in — is `@kanzo-tech/ai/data`, because it needs the analytics, table and editor peers
// this barrel must not.
//
// Depends on @kanzo-tech/ui, never the reverse. A consumer who wants a Button never pays for a
// transcript.

export { AssistProvider, Assist } from "./assist.js";
export type { AssistProviderProps, AssistProps, AssistTranslations } from "./assist.js";
export type { AssistEvent, Proposal } from "./engine.js";

export { Chat, ChatSkeleton } from "./chat.js";
export type { ChatProps, ChatSkeletonProps, ChatToolRenderers, ChatTranslations } from "./chat.js";

// The parts `Chat` draws with, for a transcript of the host's own: a turn, a tool call bound to its
// AI SDK part, and a model's reasoning folded away.
export { Message, MessageActions, MessageAvatar, MessageContent, MessageList } from "./message.js";
export type { MessageAvatarProps, MessageProps, MessageRole } from "./message.js";
export { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool.js";
export type { ToolPart } from "./tool.js";
export { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning.js";
export type { ReasoningProps } from "./reasoning.js";

export { suggest } from "./suggest.js";
export type { SuggestOptions } from "./suggest.js";

// An agent in the page is `useAgentChat`, which keeps what it threw; an agent behind the host's own
// HTTP route is `useChat`, the AI SDK's, which is a different transport rather than a second door.
export { useAgentChat } from "./agent-chat.js";
export type { AgentChat, AgentChatOptions } from "./agent-chat.js";
export { useChat } from "@ai-sdk/react";
