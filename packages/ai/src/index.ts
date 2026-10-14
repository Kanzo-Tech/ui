// @kanzo-tech/ai — the surfaces that know a model is on the other end. Two capabilities, one door
// each: a field the model helps fill (`AssistProvider` + `Assist`) and a conversation with one
// (`Chat`, over `useAgentChat`). The parts a conversation is drawn with are exported beside it, for a host
// that draws a transcript `Chat` does not. The model behind them is the AI SDK, reached through
// `@kanzo-tech/llm`. Asking questions of data — an agent that answers with a dashboard tile, and
// the card it is drawn in — is `@kanzo-tech/ai/data`, because it needs `@kanzo-tech/ui/analytics`
// and its peers, which this barrel must not.
//
// Depends on @kanzo-tech/ui, never the reverse. A consumer who wants a Button never pays for a
// transcript.

export { AssistProvider, Assist } from "./assist.js";
export type { AssistProviderProps, AssistProps, AssistTranslations } from "./assist.js";
// What a field is offered is the Task's `Proposal<string>`, imported from `@kanzo-tech/ai/task` with
// the rest of a Task's types — one name, one door.
export type { AssistEvent } from "./engine.js";

export { Chat, ChatSkeleton } from "./chat.js";
export type {
  ChatMessage,
  ChatProposals,
  ChatProps,
  ChatSkeletonProps,
  ChatToolRenderers,
  ChatTranslations,
} from "./chat.js";

// The parts `Chat` draws with, for a transcript of the host's own: the scroll region that follows
// the tail only while the reader is there, a turn, a tool call bound to its AI SDK part, a model's
// reasoning folded away, and the composer.
export { Conversation, ConversationContent, ConversationScrollButton } from "./conversation.js";
export { Message, MessageContent, MessageList } from "./message.js";
export type { MessageProps } from "./message.js";
export { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool.js";
export type { ToolPart } from "./tool.js";
export { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning.js";
export type { ReasoningProps } from "./reasoning.js";
export {
  PromptInput,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "./prompt-input.js";
export type { PromptInputSubmitProps } from "./prompt-input.js";

// The parts a conversation whose turns the host decides is drawn with, beyond the transcript's: a
// question put to the person, answered by picking; work under way, said; a model in the page, as it
// loads; and a point in the transcript the host can go back to. What a model offers is `@kanzo-tech/ui`'s `Suggestions`, which knows no model.
export {
  Question,
  QuestionDescription,
  QuestionOption,
  QuestionOptions,
  QuestionPrompt,
} from "./question.js";
export { Working, type WorkingProps } from "./working.js";
export { ModelBadge } from "./model-badge.js";
export type { ModelBadgeProps, ModelBadgeTranslations } from "./model-badge.js";
export { Checkpoint, CheckpointIcon, CheckpointTrigger } from "./checkpoint.js";
export type { CheckpointTranslations, CheckpointTriggerProps } from "./checkpoint.js";

// What a Task offers a screen, as a list it asks for, edits and dismisses.
export { useTask } from "./use-task.js";
export type { TaskList, TaskListState, UseTaskOptions } from "./use-task.js";

// An agent in the page is `useAgentChat`, which keeps what it threw. An agent behind the host's own
// HTTP route is `useChat`, imported from `@ai-sdk/react` — a required peer, so already installed —
// and not passed through here: a name on this barrel is ours or it is not on it.
export { useAgentChat } from "./agent-chat.js";
export type { AgentChat, AgentChatOptions } from "./agent-chat.js";
