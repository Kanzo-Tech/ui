/**
 * The two doors through which every model call the library makes passes — `stream`, and `generate`
 * for an answer read whole — each asking once, and the failure a model names.
 *
 * The AI SDK is a required peer and **none of it is re-exported**: `ai` is a package every host and
 * every package here already imports by name, so a re-export was a second way to write one import
 * (`/docs/design/tasks#where-each-dependency-lives`). What is ours is only the door the SDK lacks. The
 * model itself is `localModel`, on `/local`, and the test double on `/testing`: their peers are
 * optional, so neither is on this barrel.
 */

export { LlmError } from "./error.js";
export { generate, type Generated, type GenerateOptions } from "./generate.js";
export { stream, type Stream, type StreamOptions } from "./stream.js";
export type { ModelLoad } from "./load.js";
