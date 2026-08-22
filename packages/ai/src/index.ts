// @kanzo-tech/ai — the surfaces that know a model is on the other end.
//
// The line against @kanzo-tech/ui is not "is it AI", it is **does the component know a model
// exists**. `Suggest` does not — it takes candidates and a callback, and a human typing would be
// indistinguishable — but it moved here anyway, with `Complete` and the engine, because the ✨
// marks a field as model-assisted to the reader and that mark is the thing being sold. What stayed
// behind is every part these draw with.
//
// Depends on @kanzo-tech/ui, never the reverse. A consumer who wants a Button never pays for a
// transcript.

// ── The transcript ───────────────────────────────────────────────────────────
export {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollButton,
} from "./conversation.js";
export {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageList,
} from "./message.js";
export { MessageText } from "./message-text.js";
export type { MessageProps, MessageAvatarProps, MessageRole } from "./message.js";
export type { MessageTextProps } from "./message-text.js";

// ── The composer ─────────────────────────────────────────────────────────────
export {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "./prompt-input.js";
export type { PromptInputSubmitProps } from "./prompt-input.js";

// ── What the model did on the way ────────────────────────────────────────────
export { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning.js";
export type { ReasoningProps } from "./reasoning.js";
export { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool.js";
export type { ToolProps, ToolIoProps } from "./tool.js";
export { Task, TaskList, TaskStatus, TaskTitle } from "./task.js";
export type { TaskProps, RunState } from "./task.js";

// ── The field affordances ────────────────────────────────────────────────────
export {
  CompleteRoot,
  CompleteTextarea,
  CompleteGhost,
  CompleteHint,
  CompleteKeys,
  CompleteError,
  CompleteMark,
} from "./complete.js";
// The ✨ itself, dumb: `offering` / `busy` / `label`, and each compound binds it. It marks a field
// as model-assisted at rest, which is the job `SuggestTrigger` could not do for `Complete` and
// `Complete` did not do at all.
export { AiMark } from "./ai-mark.js";
export type { AiMarkProps } from "./ai-mark.js";
export { SuggestRoot, SuggestMark, SuggestList } from "./suggest.js";
export type { SuggestRootProps, SuggestListProps, SuggestTrigger } from "./suggest.js";
export type { CompleteRootProps } from "./complete.js";

export { useAiStream, useInlineCompletion, useSuggestions, cleanGhost } from "./use-ai.js";
export type {
  AiStatus,
  AiStream,
  InlineCompletion,
  InlineCompletionRequest,
  InlineCompletionTrigger,
  SuggestionsController,
  UseInlineCompletionOptions,
  UseSuggestionsOptions,
} from "./use-ai.js";

export type { Suggestion } from "./types.js";

// The wire format the components draw. Types plus four guards — this module renders nothing, and
// the `switch` over `part.type` stays the host's.
export { isTextPart, isReasoningPart, isToolPart, isTaskPart } from "./message-part.js";
export type {
  AiMessage,
  AiMessagePart,
  AiReasoningPart,
  AiTaskPart,
  AiTextPart,
  AiToolPart,
  StreamState,
} from "./message-part.js";
