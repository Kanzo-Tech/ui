/**
 * **What a canvas knows and the DOM does not**, reached through a global only a test defines — and
 * what a scripted model was asked. `GraphCanvas` registers itself here when they
 * find it on `window`, and do nothing otherwise, so production never has it. React DevTools'
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__` is the shape: the tool defines the global, the library registers
 * with it.
 *
 * A model is not registered here: the environment registers a scripted one in `@kanzo-tech/llm/local`'s
 * provider registry, as any provider is ({@link install}), and records each prompt here.
 *
 * The type is declared once, here, because this package is what installs it: `@kanzo-tech/ui` and
 * `@kanzo-tech/graph` import it as a type from a devDependency.
 */
export interface KanzoTestingHook {
  /** By the canvas element's `id`. Both answers are in pixels from the canvas's top-left corner. */
  graphs: Map<string, GraphProbe>;
  /**
   * By model id: the script a test registered, which `localModel(id)` answers from in place of that
   * model, and every prompt it was asked, flattened, in order.
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

/**
 * What a model call carries that the double reads: its messages, and the signal that stops it. The
 * AI SDK's call options (`LanguageModelV4CallOptions`) are one, declared here by shape because this
 * package imports nothing of the AI SDK's.
 */
export interface PromptedCall {
  readonly prompt: readonly { readonly role: string; readonly content: string | readonly object[] }[];
  readonly abortSignal?: AbortSignal;
}

/** Everything a call was told — system, user, assistant and tool messages — flattened to text: what a turn's `when` is matched against. */
export function promptOf(call: PromptedCall): string {
  return call.prompt
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? String(p.text) : ""))))
    .join("\n");
}

/** What {@link scripted} answers with: the two calls of an AI SDK `LanguageModelV4`, by its spec's shape. */
export interface ScriptedCalls<Call extends PromptedCall = PromptedCall> {
  doGenerate(call: Call): Promise<{ content: object[]; finishReason: object; usage: object; warnings: [] }>;
  doStream(call: Call): Promise<{ stream: ReadableStream<object> }>;
}

/**
 * **The one model double's answering**: each call answered from `script` as the AI SDK's
 * `LanguageModelV4` spec answers one — a whole answer, or a stream a word at a time with its thinking
 * first. In a unit test `turns` may be a function of the call and its index among the calls of its
 * kind; that never crosses into a page. `@kanzo-tech/llm/testing`'s `scriptedModel` is the SDK's `MockLanguageModelV4` over it, and
 * {@link install} registers it, for a page, under each scripted id.
 *
 * **Self-contained on purpose**, but for {@link promptOf}: Playwright sends it into the page as source
 * text, declared beside `promptOf`, so it may close over nothing else. `pace` is read when each call
 * begins, so a page may change it between calls.
 */
export function scripted<Call extends PromptedCall>(
  script: ModelScript | (Omit<ModelScript, "turns"> & { readonly turns: (call: Call, index: number) => ModelReply }),
): ScriptedCalls<Call> {
  const USAGE = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  const abort = (signal: AbortSignal | undefined) => signal?.reason ?? new DOMException("Stopped", "AbortError");
  /** Settles when `signal` aborts, by rejecting with its reason: a call that never answers. */
  const stopped = (signal: AbortSignal | undefined) =>
    new Promise<never>((_, reject) => {
      if (signal?.aborted) return reject(abort(signal));
      signal?.addEventListener("abort", () => reject(abort(signal)), { once: true });
    });
  const sleep = (ms: number, signal: AbortSignal | undefined) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(abort(signal));
      if (ms <= 0) return resolve();
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => (clearTimeout(timer), reject(abort(signal))), { once: true });
    });
  const words = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];
  const written = (reply: { text: string; reasoning?: string } | { object: unknown }) =>
    "object" in reply ? { text: JSON.stringify(reply.object), reasoning: undefined } : reply;
  const pace = () => script.pace;
  // A script as the function it amounts to: the first unspent turn whose `when` the prompt contains.
  const turns = script.turns;
  const spent = new Set<ModelTurn>();
  const answer =
    typeof turns === "function"
      ? turns
      : (call: Call): ModelReply => {
          const prompt = promptOf(call);
          const turn = turns.find((t) => !spent.has(t) && (t.when === undefined || prompt.includes(t.when)));
          if (!turn) return { fail: `The model double has no turn for: ${prompt.slice(0, 120)}` };
          if (turn.once) spent.add(turn);
          return turn.reply;
        };
  let generated = 0;
  let streamed = 0;
  return {
    async doGenerate(call) {
      const reply = answer(call, generated++);
      if ("hang" in reply) return stopped(call.abortSignal);
      if ("fail" in reply) throw new Error(reply.fail);
      if ("tool" in reply) throw new Error("A whole answer calls no tool: script the agent's call to a stream.");
      const { text, reasoning } = written(reply);
      await sleep((pace()?.wait ?? 0) + words(text).length * (pace()?.perWord ?? 0), call.abortSignal);
      return {
        content: [...(reasoning ? [{ type: "reasoning", text: reasoning }] : []), { type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: USAGE,
        warnings: [],
      };
    },
    async doStream(call) {
      const index = streamed++;
      const reply = answer(call, index);
      const signal = call.abortSignal;
      return {
        stream: new ReadableStream<object>({
          async start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            if ("hang" in reply) {
              stopped(signal).catch((reason: unknown) => controller.error(reason));
              return;
            }
            try {
              await sleep(pace()?.wait ?? 0, signal);
              const reasoning = "reasoning" in reply ? reply.reasoning : undefined;
              if (reasoning) {
                controller.enqueue({ type: "reasoning-start", id: "r" });
                for (const delta of words(reasoning)) {
                  await sleep(pace()?.perWord ?? 0, signal);
                  controller.enqueue({ type: "reasoning-delta", id: "r", delta });
                }
                controller.enqueue({ type: "reasoning-end", id: "r" });
              }
              if ("tool" in reply) {
                controller.enqueue({ type: "tool-call", toolCallId: `call-${index}`, toolName: reply.tool, input: JSON.stringify(reply.input) });
                controller.enqueue({ type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: USAGE });
                controller.close();
                return;
              }
              const text = "fail" in reply ? (reply.after ?? "") : written(reply).text;
              controller.enqueue({ type: "text-start", id: "t" });
              for (const delta of words(text)) {
                await sleep(pace()?.perWord ?? 0, signal);
                controller.enqueue({ type: "text-delta", id: "t", delta });
              }
              if ("fail" in reply) {
                controller.enqueue({ type: "error", error: new Error(reply.fail) });
              } else {
                controller.enqueue({ type: "text-end", id: "t" });
                controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE });
              }
              controller.close();
            } catch (reason) {
              controller.error(reason);
            }
          },
        }),
      };
    },
  };
}

/**
 * The global `@kanzo-tech/llm/local` resolves a model id through, as this package writes to it: the
 * models registered by id, and the host's provider behind them. Declared by shape, because this
 * package imports nothing of `@kanzo-tech/llm`'s; `/docs/design/testing#a-model-is-resolved-through-one-registry`
 * is the contract, and `packages/llm/src/testing.test.ts` holds the two to each other.
 */
interface LocalModelRegistry {
  languageModels: Map<string, { model: object; load(): Promise<void> }>;
  fallbackProvider?: unknown;
}

/**
 * Defines the hook on the page it runs in, once, and **registers a provider per scripted model id**
 * in `@kanzo-tech/llm/local`'s registry — `Symbol.for("@kanzo-tech/llm/local")` on `globalThis` — which
 * answers from the script with {@link scripted}, records each prompt on the hook, and loads as the
 * script says. `localModel(id)` resolves it there as it resolves any provider; nothing in the page's
 * code knows a test is running.
 *
 * Self-contained but for {@link scripted} and {@link promptOf}: {@link initScript} sends the three
 * into the page as source text.
 */
export function install(models: Readonly<Record<string, ModelScript>> = {}): void {
  const scope = globalThis as { __KANZO_TESTING__?: KanzoTestingHook } & { [key: symbol]: LocalModelRegistry | undefined };
  const hook = (scope.__KANZO_TESTING__ ??= { graphs: new Map(), models: new Map() });
  const registry = (scope[Symbol.for("@kanzo-tech/llm/local")] ??= { languageModels: new Map() });
  for (const [id, script] of Object.entries(models)) {
    const probe: ModelProbe = { script, prompts: [] };
    hook.models.set(id, probe);
    const calls = scripted(script);
    registry.languageModels.set(id, {
      model: {
        specificationVersion: "v4",
        provider: "kanzo-testing",
        modelId: id,
        supportedUrls: {},
        doGenerate: (call: PromptedCall) => (probe.prompts.push(promptOf(call)), calls.doGenerate(call)),
        doStream: (call: PromptedCall) => (probe.prompts.push(promptOf(call)), calls.doStream(call)),
      },
      load: async () => {
        if (script.load) throw new Error(script.load.fail);
      },
    });
  }
}

/**
 * {@link install} as the source Playwright's `addInitScript` runs before the page's own: the three
 * functions it needs, declared, then called with `models` as JSON. A function does not cross into the
 * page; its text does.
 */
export function initScript(models: Readonly<Record<string, ModelScript>>): string {
  return `${promptOf}\n${scripted}\n(${install})(${JSON.stringify(models)});`;
}
