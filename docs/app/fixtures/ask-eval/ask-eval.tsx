"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { attachWritten } from "@/lib/attach-graph";
import { Show, Skeleton } from "@kanzo-tech/ui";
import { engine, type Engine } from "@kanzo-tech/mosaic/engine";
import type { Graph, Pattern } from "@kanzo-tech/graphar-duckdb";
import { Dashboard, FilterBar, MosaicProvider, useMosaic, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { Chat, ModelBadge } from "@kanzo-tech/ai";
import { AnswerCard, useAskChat, type AskOutput } from "@kanzo-tech/ai/data";
import { loadLocalModel, localModel, localModelLoad, localProvider, setLocalProvider, watchLocalModel } from "@kanzo-tech/llm/local";

/**
 * **The page Ask's evaluation set asks on** — `packages/ai/eval/ask.eval.ts`. Everything it is, it
 * reads from its address, so one page serves every case:
 *
 * - `corpus` — the corpus's name: `public/corpus/<name>`, written by `packages/ai/eval/corpus.mjs`,
 *   attached under that name as its catalog.
 * - `pattern` — the dashboard's pattern, as JSON: `[{"as":"award","type":"LaureateAward"}]`.
 * - `filter` — a field of it, `variable.property`, or nothing: one bar tile counting it, which the runner picks a bar on,
 *   so the question is asked under the page's filter as a reader's would be.
 * - `model` — the model in the page, a WebLLM id from its prebuilt list; Qwen3 4B by default,
 *   keasy's. A test that registered a script for that id has registered its provider, which
 *   `localModel` resolves as it resolves WebLLM's.
 *
 * Nothing else: no offers, no chips, no dashboard to add to. They are not what a case scores, and a
 * model asked for offers beside the question is a model slower to answer it.
 */

/** The model a run measures unless `?model=` names another: what keasy's pages run. */
const MODEL = "Qwen3-4B-q4f16_1-MLC";

/** The composer's placeholder, and so its name: what the runner finds it by. */
const PLACEHOLDER = "Ask about your data…";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Setup {
  corpus: string;
  pattern: Pattern;
  filter: string | null;
  model: string;
}

/** What the page has once its corpus is attached: the graph — every type's facts with it. */
interface Attached {
  engine: Engine;
  graph: Graph;
}

async function open(setup: Setup, signal: AbortSignal): Promise<Attached> {
  const page = await engine({ signal });
  // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem.
  const graph = await attachWritten(page, setup.corpus, `${window.location.origin}${BASE}/corpus/${setup.corpus}`, signal);
  signal.throwIfAborted();
  return { engine: page, graph };
}

export function AskEval() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [attached, setAttached] = useState<Attached | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const read = new URLSearchParams(window.location.search);
    setSetup({
      corpus: read.get("corpus") ?? "nobel",
      pattern: JSON.parse(read.get("pattern") ?? '[{"as":"award","type":"LaureateAward"}]') as Pattern,
      filter: read.get("filter"),
      model: read.get("model") ?? MODEL,
    });
  }, []);

  useEffect(() => {
    if (!setup) return;
    const controller = new AbortController();
    open(setup, controller.signal).then(
      (opened) => !controller.signal.aborted && setAttached(opened),
      (error: unknown) => !controller.signal.aborted && setFailure(error instanceof Error ? error.message : String(error)),
    );
    return () => controller.abort();
  }, [setup]);

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)_28rem] bg-background">
      <Show when={failure !== null}>
        <p className="p-4 text-destructive-foreground" role="alert">
          {failure}
        </p>
      </Show>
      <Show when={failure === null && (!setup || !attached)}>
        <Skeleton className="m-4 h-96" />
      </Show>
      {setup && attached && (
        <MosaicProvider engine={attached.engine} graph={attached.graph}>
          <Board filter={setup.filter} pattern={setup.pattern} />
          <Ask attached={attached} model={setup.model} />
        </MosaicProvider>
      )}
    </div>
  );
}

/** The pattern's dashboard: the filter bar, whose readout is what the page keeps, and the filter's tile. */
function Board({ pattern, filter }: { pattern: Pattern; filter: string | null }) {
  const initial = useMemo<DashboardSpec>(
    () => ({
      filters: [],
      tiles: filter ? [{ id: "filter", kind: "chart", span: 3, type: "bar", title: `Count by ${filter}`, x: filter, y: { op: "count" } }] : [],
    }),
    [filter],
  );
  const [spec, setSpec] = useState<DashboardSpec | undefined>(initial);
  return (
    <section aria-label="Dashboard" className="flex min-h-0 flex-col gap-4 overflow-auto p-4">
      <FilterBar relation={pattern} />
      <Dashboard onChange={setSpec} relation={pattern} value={spec} />
    </section>
  );
}

/** Ask on the page's selection, with the model in the page and its load said by its badge. */
function Ask({ attached, model }: { attached: Attached; model: string }) {
  // The provider, set once before anything asks: WebLLM's prebuilt list, in a worker of its own —
  // a long prefill on the page's thread would hold the harnesses' every read until it ends.
  useState(() => setLocalProvider(localProvider({ worker: new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module" }) })));
  const asked = useMemo(() => localModel(model), [model]);
  const load = useSyncExternalStore(
    (listener) => watchLocalModel(model, listener),
    () => localModelLoad(model),
    () => localModelLoad(model),
  );
  // Loaded as the page opens, so the first question measures the model and not its download.
  useEffect(() => {
    loadLocalModel(model).catch(() => {}); // Not lost: the badge says it failed, and why.
  }, [model]);
  // Under the page's one selection: an answer is read under its filter, and must reach its pattern.
  const { selection } = useMosaic();
  const chat = useAskChat({ model: asked, engine: attached.engine, graph: attached.graph, selection });

  return (
    <aside aria-label="Ask" className="flex min-h-0 flex-col border-s p-2">
      <Chat
        chat={chat}
        context={<ModelBadge load={load} />}
        data={{ answer: (part, { stopped }) => <AnswerCard answer={part.data as AskOutput} graph={attached.graph} stopped={stopped} /> }}
        translations={{ placeholder: PLACEHOLDER }}
      />
    </aside>
  );
}
