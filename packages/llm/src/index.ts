/**
 * The model conversation, as one import.
 *
 * Same standing as `@kanzo-tech/mosaic`: the third party — here the AI SDK — is a required peer, its
 * surface is re-exported so a host never imports `ai` itself, and what is ours is the one door it
 * does not have. A host reaches a model only through `createKanzo`, an agent through
 * `ToolLoopAgent`, and a conversation through `@kanzo-tech/ai`'s `useChat`, so one copy of the SDK
 * is the easy outcome.
 */

export {
  DirectChatTransport,
  Output,
  ToolLoopAgent,
  getToolName,
  isToolUIPart,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ChatStatus,
  type DynamicToolUIPart,
  type InferAgentUIMessage,
  type LanguageModel,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";

/** Ours: the one door to a model. */
export { createKanzo, type Kanzo, type KanzoSettings } from "./kanzo.js";
