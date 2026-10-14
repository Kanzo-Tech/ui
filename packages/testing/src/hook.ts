/**
 * **What a canvas knows and the DOM does not**, reached through a global only a test defines —
 * and the model a test scripts. `GraphCanvas` and `ChartRoot` register themselves here when they find
 * it on `window`, and `localModel` answers with a script registered here, and each does nothing
 * otherwise, so production never has it. React DevTools' `__REACT_DEVTOOLS_GLOBAL_HOOK__` is the
 * shape: the tool defines the global, the library registers with it.
 *
 * The type is declared once, here, because this package is what installs it: `@kanzo-tech/ui`,
 * `@kanzo-tech/graph` and `@kanzo-tech/llm` import it as a type from a devDependency, and only the
 * script reaches what one of them publishes — `@kanzo-tech/llm/testing`'s double takes it.
 */
export interface KanzoTestingHook {
  /** By the canvas element's `id`. Both answers are in pixels from the canvas's top-left corner. */
  graphs: Map<string, GraphProbe>;
  /** By the chart's accessible name, its `aria-label`. */
  charts: Map<string, ChartProbe>;
  /**
   * By model id: the script a test registered, which `@kanzo-tech/llm/local`'s `localModel` answers
   * with in place of that model, and every prompt it was asked, flattened, in order.
   */
  models: Map<string, ModelProbe>;
}

export interface ModelProbe {
  readonly script: ModelScript;
  readonly prompts: string[];
}

/**
 * **What a model double answers**, as data: it crosses into the page as `addInitScript`'s argument,
 * and a function does not. Each call is answered by the first turn whose `when` its prompt contains
 * (a turn with none matches every call); a turn that is `once` answers one call and gives way.
 * A call no turn matches fails, naming its prompt.
 */
export interface ModelScript {
  readonly turns: readonly ModelTurn[];
  /**
   * How fast it answers, read when each call begins: `wait` ms before the first word, then `perWord`
   * ms a word — a stream a word at a time, a whole answer after the lot. Left out, it answers at once.
   */
  readonly pace?: { wait?: number; perWord?: number };
  /** The model's load fails with these words, as WebLLM's does when a shard cannot be fetched. */
  readonly load?: { fail: string };
}

export interface ModelTurn {
  /** Answers a call whose prompt — every message, flattened — contains this. */
  readonly when?: string;
  /** Answers one call, then gives way to the next turn that matches. */
  readonly once?: boolean;
  readonly reply: ModelReply;
}

/** What one call answers. */
export type ModelReply =
  /** Text, with the thinking before it when there is some. */
  | { text: string; reasoning?: string }
  /** A structured answer — `Output.object`'s object, or `Output.array`'s `{ elements }` — as its JSON. */
  | { object: unknown }
  /** A call to a tool, for an agent. */
  | { tool: string; input: unknown; reasoning?: string }
  /** The call fails with these words — a stream after writing `after` first. */
  | { fail: string; after?: string }
  /** The call never answers, until it is stopped. */
  | { hang: true };

export interface GraphProbe {
  /** Where a vertex is drawn now, read from cosmos.gl's own space-to-screen conversion. */
  screenOf(vertex: number): [number, number];
  /** Where a point in the data's `x`/`y` is drawn now; a layout that binds neither is its space. */
  screenAt(point: { x: number; y: number }): [number, number];
}

export interface ChartProbe {
  /** Observable Plot's own `figure.scale(channel)`, in the plot's SVG pixels. */
  scale(channel: "x" | "y" | "color"): { apply(value: unknown): number; invert?(pixel: number): unknown };
}

/**
 * Defines the hook on the page it runs in, once, and registers `models`' scripts on it.
 * **Self-contained on purpose**: Playwright sends it to the page as source text through
 * `addInitScript`, with `models` as its argument, so it may close over nothing.
 */
export function install(models: Readonly<Record<string, ModelScript>> = {}): void {
  const scope = globalThis as { __KANZO_TESTING__?: KanzoTestingHook };
  const hook = (scope.__KANZO_TESTING__ ??= { graphs: new Map(), charts: new Map(), models: new Map() });
  for (const [id, script] of Object.entries(models)) hook.models.set(id, { script, prompts: [] });
}
