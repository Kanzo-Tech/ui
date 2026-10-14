"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { attach } from "@fossil-lang/corpus";
import { Show, Skeleton } from "@kanzo-tech/ui";
import {
  Dashboard,
  engine,
  FilterBar,
  MosaicProvider,
  relationHops,
  useMosaic,
  type Coordinator,
  type DashboardSpec,
  type Engine,
  type JoinGraph,
  type Relation,
} from "@kanzo-tech/ui/analytics";
import { Chat, ModelBadge } from "@kanzo-tech/ai";
import { AnswerCard, answerRelationsOf, readAnswerRelations, useAskChat, type AnswerRelation } from "@kanzo-tech/ai/data";
import { loadLocalModel, localModel, localModelLoad, watchLocalModel } from "@kanzo-tech/llm/local";
import { readJoinGraph } from "@kanzo-tech/graph";

/**
 * **The page Ask's evaluation set asks on** — `packages/ai/eval/ask.eval.ts`. Everything it is, it
 * reads from its address, so one page serves every case:
 *
 * - `corpus` — the corpus's name: `public/corpus/<name>`, written by `packages/ai/eval/corpus.mjs`,
 *   attached under that name as its catalog.
 * - `relation` — the dashboard's relation, by its key: `LaureateAward>category>Category`.
 * - `filter` — a field of it, or nothing: one bar tile counting it, which the runner picks a bar on,
 *   so the question is asked under the page's filter as a reader's would be.
 * - `model` — the model in the page, a WebLLM id; Qwen3 4B by default, keasy's. A test that
 *   registered a script for that id gets `@kanzo-tech/llm/testing`'s double instead.
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
  relation: string;
  filter: string | null;
  model: string;
}

/** What the page has once its corpus is attached and read: the graph, its types, and the relation on screen. */
interface Attached {
  engine: Engine;
  coordinator: Coordinator;
  graph: JoinGraph;
  types: AnswerRelation[];
  relation: Relation;
}

/**
 * A relation's key read back against the graph: `Root`, then each hop as `>label>Type` out of a type
 * or `<label<Type` into it — `relationKey`'s spelling.
 */
function relationFrom(graph: JoinGraph, key: string): Relation {
  const [root, ...rest] = key.split(/(?=[<>][^<>]+[<>])/);
  const path: Relation["path"][number][] = [];
  let at = root!;
  for (const step of rest) {
    const [, arrow, label, to] = /^([<>])([^<>]+)[<>](.+)$/.exec(step) ?? [];
    const hop = relationHops(graph, at).find(
      (h) => h.label === label && h.to === to && h.hop.direction === (arrow === ">" ? "out" : "in"),
    );
    if (!hop) throw new Error(`No hop ${step} from ${at} in the corpus`);
    path.push(hop.hop);
    at = hop.to;
  }
  if (!graph.types.some((t) => t.name === root)) throw new Error(`No type ${root} in the corpus`);
  return { root: root!, path };
}

async function open(setup: Setup, signal: AbortSignal): Promise<Attached> {
  const page = await engine({ signal });
  // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem.
  await attach(setup.corpus, { engine: page, url: `${window.location.origin}${BASE}/corpus/${setup.corpus}` });
  const graph = await readJoinGraph(page.coordinator, setup.corpus);
  const types = await readAnswerRelations(page.coordinator, graph, answerRelationsOf(graph, { hops: 0 }), { signal });
  return { engine: page, coordinator: page.coordinator, graph, types, relation: relationFrom(graph, setup.relation) };
}

export function AskEval() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [attached, setAttached] = useState<Attached | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const read = new URLSearchParams(window.location.search);
    setSetup({
      corpus: read.get("corpus") ?? "nobel",
      relation: read.get("relation") ?? "LaureateAward",
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
        <MosaicProvider coordinator={attached.coordinator} joins={attached.graph}>
          <Board attached={attached} filter={setup.filter} />
          <Ask attached={attached} model={setup.model} />
        </MosaicProvider>
      )}
    </div>
  );
}

/** The relation's dashboard: the filter bar, whose readout is what the page keeps, and the filter's tile. */
function Board({ attached, filter }: { attached: Attached; filter: string | null }) {
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
      <FilterBar relation={attached.relation} />
      <Dashboard onChange={setSpec} relation={attached.relation} value={spec} />
    </section>
  );
}

/** Ask on the page's selection, with the model in the page and its load said by its badge. */
function Ask({ attached, model }: { attached: Attached; model: string }) {
  // The worker the engine runs in, made once: a long prefill on the page's thread would hold the
  // harnesses' every read until it ends.
  const worker = useMemo(() => new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module" }), []);
  const asked = useMemo(() => localModel(model, { worker }), [model, worker]);
  const load = useSyncExternalStore(
    (listener) => watchLocalModel(model, listener),
    () => localModelLoad(model),
    () => localModelLoad(model),
  );
  // Loaded as the page opens, so the first question measures the model and not its download.
  useEffect(() => {
    loadLocalModel(model, { worker }).catch(() => {}); // Not lost: the badge says it failed, and why.
  }, [model, worker]);
  // Under the page's one selection: an answer is read under its filter, and must reach its relation.
  const { selection } = useMosaic();
  const chat = useAskChat({ model: asked, engine: attached.engine, graph: attached.graph, types: attached.types, selection });

  return (
    <aside aria-label="Ask" className="flex min-h-0 flex-col border-s p-2">
      <Chat
        chat={chat}
        context={<ModelBadge load={load} />}
        tools={{ answer: (part, { stopped }) => <AnswerCard graph={attached.graph} part={part} stopped={stopped} /> }}
        translations={{ placeholder: PLACEHOLDER }}
      />
    </aside>
  );
}
