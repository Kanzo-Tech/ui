// @kanzo-tech/ai — the surfaces that know a model is on the other end. Two capabilities, one door
// each: a field the model helps fill (`AssistProvider` + `Assist`) and a conversation with one
// (`Chat`, over `useChat`). Everything they draw with is internal; the model behind them is the AI
// SDK, reached through `@kanzo-tech/llm`.
//
// Depends on @kanzo-tech/ui, never the reverse. A consumer who wants a Button never pays for a
// transcript.

export { AssistProvider, Assist } from "./assist.js";
export type { AssistProviderProps, AssistProps, AssistTranslations } from "./assist.js";
export type { AssistEvent, Proposal } from "./engine.js";

export { Chat } from "./chat.js";
export type { ChatProps, ChatToolRenderers, ChatTranslations } from "./chat.js";
export type { ToolPart } from "./tool.js";

export { useChat } from "@ai-sdk/react";
