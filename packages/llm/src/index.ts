/**
 * The model conversation, as one import.
 *
 * Same standing as `@kanzo-tech/mosaic`: the third party — here the AI SDK — is a required peer, its
 * surface is re-exported so a host never imports `ai` itself, and what is ours is the door it does
 * not have. A host reaches an answer through `stream`, an agent through `ToolLoopAgent`, and a
 * conversation through `@kanzo-tech/ai`'s `useChat`, so one copy of the SDK is the easy outcome. The
 * model itself is `localModel`, on `/local`: its peers are optional, so it is not on this barrel.
 */

export {
  DirectChatTransport,
  Output,
  ToolLoopAgent,
  getToolName,
  isToolUIPart,
  jsonSchema,
  stepCountIs,
  tool,
  type Agent,
  type ChatStatus,
  type DynamicToolUIPart,
  type InferAgentUIMessage,
  type LanguageModel,
  type ReasoningUIPart,
  type Tool,
  type ToolSet,
  type ToolUIPart,
  type UIMessage,
} from "ai";

/** Ours: the failure a model names, and the one door to an answer. */
export { AiError } from "./error.js";
export { stream, type Stream, type StreamOptions } from "./stream.js";
