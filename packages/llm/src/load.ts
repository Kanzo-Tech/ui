/**
 * Where a model that has to be fetched before it answers stands: not asked for yet, downloading and
 * loading (`progress` from 0 to 1, with the engine's words for what it is doing), ready, or failed
 * with what stopped it, whole. `@kanzo-tech/llm/local` reports it (`localModelLoad`); `@kanzo-tech/ai`'s
 * `ModelStatus` draws it. Not WebLLM's own shape, so neither side imports the other's peers.
 */
export type ModelLoad =
  | { readonly state: "idle" }
  | { readonly state: "loading"; readonly progress: number; readonly text: string }
  | { readonly state: "ready" }
  | { readonly state: "failed"; readonly error: unknown };
