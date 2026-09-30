import type { MosaicClient } from "@kanzo-tech/mosaic";
import { domainOf } from "./categories";
import { bindingOf } from "./channels";
import type { Corpus, Filter, VertexTable } from "./corpus-contract";
import { filterFor, graphClient, publish } from "./filter";
import { drawnTables, loadEncoding, loadGraph, maskOf, readKept, type Encoding, type Geometry, type Kept } from "./load";
import type { Drawn, GraphOptions, GraphSnapshot, GraphStatus, GraphStore } from "./state";

export type { Drawn, GraphOptions, GraphSnapshot, GraphState, GraphStatus, GraphStore } from "./state";

const sameFilter = (a: Filter | undefined, b: Filter | undefined) =>
  JSON.stringify(a, (_, v: unknown) => (typeof v === "bigint" ? `${v}n` : v)) ===
  JSON.stringify(b, (_, v: unknown) => (typeof v === "bigint" ? `${v}n` : v));

const isPromise = (value: unknown): value is PromiseLike<Corpus> =>
  typeof (value as PromiseLike<Corpus> | null)?.then === "function";

function drawnOf(geometry: Geometry, encoding: Encoding, mask: Uint8Array | null): Drawn {
  const tally = encoding.domain.map(() => 0);
  let vertices = 0;
  for (let id = 0; id < geometry.size; id++) {
    if ((mask && !mask[id]) || Number.isNaN(geometry.positions[id * 2])) continue;
    vertices++;
    const rank = encoding.ranks[id] as number;
    tally[rank] = (tally[rank] ?? 0) + 1;
  }
  return { vertices, domain: encoding.domain, tally };
}

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();
  const self: MosaicClient = graphClient();

  let corpus: Corpus | null = null;
  let opening: PromiseLike<Corpus> | null = null;
  let failed = false;
  let unrenderable = false;
  let tables: readonly VertexTable[] = [];
  let binding = bindingOf(initial);
  let filter: Filter | undefined;
  let loading: AbortController | null = null;
  let filtering: AbortController | null = null;
  let geometry: Geometry | null = null;
  let encoding: Encoding | null = null;
  let kept: Kept | null = null;
  let mask: Uint8Array | null = null;
  let uploaded: readonly unknown[] = [];
  let unlisten: (() => void) | null = null;
  let active = false;

  // A failure found while the store is being built is found while React is still rendering —
  // `useGraph` builds it in `useState` — and a host's `onFailure` is usually a `setState`. It is held
  // and reported to the first subscriber, which arrives in the commit phase.
  let building = true;
  let held: string | null = null;
  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (building) held = message;
    else options.onFailure(message);
  };

  let snapshot: GraphSnapshot = {
    status: "none",
    total: undefined,
    drawn: null,
    domain: [],
    selection: null,
    focus: null,
    hovered: null,
    pinned: [],
    tool: null,
    motion: "settled",
    progress: 1,
    options,
    corpus: null,
    binding,
    geometry: null,
    encoding: null,
    mask: null,
  };

  let domain: { key: unknown[]; value: readonly unknown[] } = { key: [], value: [] };
  function domainNow(): readonly unknown[] {
    const key = [tables, binding.byTable, binding.category, options.categories];
    if (key.some((part, i) => part !== domain.key[i])) domain = { key, value: domainOf(tables, binding, options.categories) };
    return domain.value;
  }

  let drawn: { key: unknown[]; value: Drawn | null } = { key: [], value: null };
  function drawnNow(): Drawn | null {
    const key = [geometry, encoding, mask];
    if (key.some((part, i) => part !== drawn.key[i])) {
      drawn = { key, value: geometry && encoding ? drawnOf(geometry, encoding, mask) : null };
    }
    return drawn.value;
  }

  function statusOf(): GraphStatus {
    if (failed || unrenderable) return "failed";
    if (opening) return "opening";
    if (!corpus) return "none";
    const current = [geometry, encoding, mask];
    const shown = geometry !== null && current.every((part, i) => part === uploaded[i]);
    return loading || filtering || !shown ? "loading" : "idle";
  }

  function notify(fields: Partial<GraphSnapshot> = {}): void {
    snapshot = {
      ...snapshot,
      total: corpus ? tables.reduce((sum, table) => sum + table.record_count, 0) : undefined,
      drawn: drawnNow(),
      domain: domainNow(),
      options,
      corpus,
      binding,
      geometry,
      encoding,
      mask,
      ...fields,
    };
    snapshot = { ...snapshot, status: statusOf() };
    emit();
  }

  /** A change of state only — hover, focus, selection, tool, motion — derives nothing. */
  function patch(fields: Partial<GraphSnapshot>): void {
    snapshot = { ...snapshot, ...fields };
    emit();
  }

  function emit(): void {
    for (const listener of listeners) listener();
  }

  /**
   * One read in flight per kind, and a newer ask aborts the older one's statements. A load that
   * fails leaves nothing to draw; a filter that fails leaves the last picture.
   */
  function run<T>(
    current: () => AbortController | null,
    set: (aborter: AbortController | null) => void,
    fatal: boolean,
    read: (signal: AbortSignal) => Promise<T>,
    done: (value: T) => void,
  ): void {
    current()?.abort();
    const aborter = new AbortController();
    set(aborter);
    read(aborter.signal).then(
      (value) => {
        if (current() !== aborter) return;
        set(null);
        done(value);
        notify();
      },
      (error: unknown) => {
        if (current() !== aborter) return;
        set(null);
        failed ||= fatal;
        fail(error);
        notify();
      },
    );
  }

  const asLoad = [() => loading, (a: AbortController | null) => (loading = a), true] as const;
  const asFilter = [() => filtering, (a: AbortController | null) => (filtering = a), false] as const;

  function load(): void {
    const open = corpus;
    if (!open) return;
    const seed = domainNow();
    const given = geometry;
    if (given) {
      return run(...asLoad, (signal) => loadEncoding(open, given, binding, seed, signal), (next) => {
        encoding = next;
      });
    }
    run(...asLoad, (signal) => loadGraph(open, binding, seed, signal), (next) => {
      geometry = next.geometry;
      encoding = next.encoding;
      mask = geometry && kept ? maskOf(geometry, kept) : null;
    });
  }

  function refilter(): void {
    filtering?.abort();
    filtering = null;
    const open = corpus;
    if (!open || tables.length === 0) return;
    if (filter === undefined) {
      kept = null;
      mask = null;
      return;
    }
    const given = filter;
    run(...asFilter, (signal) => readKept(open, tables, given, signal), (next) => {
      kept = next;
      mask = geometry ? maskOf(geometry, next) : null;
    });
  }

  function reopen(): void {
    loading?.abort();
    filtering?.abort();
    loading = filtering = null;
    failed = false;
    geometry = encoding = mask = kept = null;
    uploaded = [];
    tables = [];
    const cleared = { selection: null, focus: null, hovered: null, pinned: [] };
    if (!corpus) return notify(cleared);
    try {
      if (corpus.manifest.format !== "fossil/1") throw new Error(`the graph reads fossil/1, and this corpus is ${corpus.manifest.format}`);
      tables = drawnTables(corpus);
      if (tables.length === 0) throw new Error("the corpus has no vertex type with a position to draw");
    } catch (error) {
      failed = true;
      fail(error);
      return notify(cleared);
    }
    load();
    refilter();
    notify(cleared);
  }

  /** A promise is adopted when it settles, and only if it is still the corpus the host means. */
  function adopt(given: GraphOptions["corpus"]): void {
    corpus = null;
    opening = isPromise(given) ? given : null;
    if (!opening) {
      corpus = given as Corpus | null;
      return reopen();
    }
    const promised = opening;
    reopen();
    promised.then(
      (opened) => {
        if (opening !== promised) return;
        opening = null;
        corpus = opened;
        reopen();
      },
      (error: unknown) => {
        if (opening !== promised) return;
        opening = null;
        failed = true;
        fail(error);
        notify();
      },
    );
  }

  function listen(): void {
    unlisten?.();
    unlisten = null;
    const crossfilter = options.filterBy;
    const changed = () => {
      let next: Filter | undefined;
      try {
        next = crossfilter ? filterFor(crossfilter, self) : undefined;
      } catch (error) {
        fail(error);
        return;
      }
      if (sameFilter(next, filter)) return;
      filter = next;
      refilter();
      notify();
    };
    if (crossfilter) {
      crossfilter.addEventListener("value", changed);
      unlisten = () => crossfilter.removeEventListener("value", changed);
    }
    changed();
  }

  const store: GraphStore = {
    /**
     * The first subscriber starts listening to the crossfilter and the last one stops it and lets the
     * graph go — `QueryObserver`'s `onSubscribe`/`onUnsubscribe`, which is what survives StrictMode
     * mounting everything twice.
     */
    subscribe(listener) {
      listeners.add(listener);
      if (!active) {
        active = true;
        listen();
        if (held !== null) {
          const message = held;
          held = null;
          options.onFailure(message);
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) store.destroy();
      };
    },
    getSnapshot: () => snapshot,
    getOptions: () => options,
    setOptions(next) {
      const previous = options;
      options = next;
      const nextBinding = bindingOf(next);
      const rebound =
        nextBinding.category !== binding.category ||
        nextBinding.byTable !== binding.byTable ||
        nextBinding.size !== binding.size ||
        next.categories !== previous.categories;
      binding = nextBinding;
      if (next.corpus !== previous.corpus) {
        adopt(next.corpus);
        if (active && next.filterBy !== previous.filterBy) listen();
        return;
      }
      if (active && next.filterBy !== previous.filterBy) listen();
      if (rebound) load();
      notify();
    },
    destroy() {
      active = false;
      unlisten?.();
      unlisten = null;
      loading?.abort();
      filtering?.abort();
      listeners.clear();
    },
    select(vertices, source = "node", label = "") {
      const selection = vertices && vertices.length > 0 ? { vertices: [...vertices], source, label } : null;
      patch({ selection });
      options.onSelect?.(selection);
      const key = tables[0]?.key;
      if (options.filterBy && key) publish(options.filterBy, self, key, selection ? selection.vertices : null);
    },
    focus(vertex) {
      if (vertex === snapshot.focus) return;
      patch({ focus: vertex });
      options.onFocus?.(vertex);
    },
    hover(vertex) {
      if (vertex !== snapshot.hovered) patch({ hovered: vertex });
    },
    pin(vertices) {
      patch({ pinned: [...vertices] });
    },
    setTool(tool) {
      if (tool !== snapshot.tool) patch({ tool });
    },
    report(motion) {
      if (motion !== snapshot.motion) patch({ motion });
    },
    reportProgress(value) {
      if (value !== snapshot.progress) patch({ progress: value });
    },
    setRenderable(renderable) {
      if (unrenderable === !renderable) return;
      unrenderable = !renderable;
      notify();
    },
    reportDrawn(drawnSnapshot) {
      const next = [drawnSnapshot.geometry, drawnSnapshot.encoding, drawnSnapshot.mask];
      if (next.every((part, i) => part === uploaded[i])) return;
      uploaded = next;
      notify();
    },
  };

  adopt(initial.corpus);
  building = false;
  return store;
}
