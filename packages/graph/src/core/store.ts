import { MosaicClient, Selection, firstDrawsPending, onFirstDraws, type Coordinator } from "@kanzo-tech/mosaic";
import { domainOf } from "./categories";
import { bindingOf } from "./channels";
import { GraphClient, publish } from "./client";
import { Problem } from "@kanzo-tech/kernel";
import { loadEncoding, loadGeometry, type Encoding, type Geometry } from "./load";
import { readCatalog } from "./catalog";
import { VERTICES } from "./source";
import { type Structure } from "./structure";
import { drawnOf, idsOf, keptOf, maskOf } from "./kept";
import { memo } from "./memo";
import { createReads, type Kind } from "./reads";
import { blank, type Arrangement, type GraphOptions, type GraphSnapshot, type DataStatus, type GraphStore, type PickSource } from "./state";

export type { Arrangement, Drawn, GraphOptions, GraphSnapshot, GraphState, DataStatus, GraphStore, View } from "./state";

/**
 * The most vertices the graph draws: 2²⁴, the last integer a `Float32` link end holds exactly. Past it
 * an id rounds to its neighbour and a link attaches to the wrong vertex, with no error.
 */
const LIMIT = 2 ** 24;

/** How many vertices `recent` keeps: a palette's short list, not a history. */
const RECENT = 5;

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();

  let failed = false, unrenderable = false;
  /** Whether `destroy` stopped the reads, so the next subscriber starts them again (StrictMode mounts twice). */
  let stopped = false;
  // Until shown once, the load also waits for every chart on the page yet to draw (`holdFirstDraw`).
  let shownOnce = false, unwatch: (() => void) | null = null;
  let binding = bindingOf(initial);
  let structure: Structure | null = null;
  let geometry: Geometry | null = null;
  let encoding: Encoding | null = null;
  let kept: Float64Array | null = null;
  let mask: Uint8Array | null = null;
  let arrangement: Arrangement | null = null;
  let uploaded: readonly unknown[] = [];
  /** Aborted when the corpus changes, the root goes and a retry starts the load anew. */
  const reads = createReads();
  let client: GraphClient | null = null;
  let connected: Coordinator | null = null;
  /** Where the client's pick is published, so a reconnect withdraws it from there. */
  let published: Selection | null = null;
  let active = false;
  /** The root's own crossfilter, for a graph no page hands one to. */
  const own = Selection.crossfilter();
  const scope = () => options.filterBy ?? own;
  /** Every place a `usePick` picks from, by name: an unconnected client its clause names in `clients`, so the place reads the subset without its own pick. */
  const sources = new Map<string, PickSource>();

  // A failure found while the store is being built is found while React is still rendering —
  // `useGraph` builds it in `useState` — and a host's `onFailure` is usually a `setState`. It is held
  // and reported to the first subscriber, which arrives in the commit phase.
  let building = true;
  let held: { error: unknown } | null = null;
  const fail = (error: unknown) => {
    if (building) held = { error };
    else options.onFailure(error);
  };

  let snapshot = blank(options, binding);

  // Each view of the graph is derived once per change of what it reads: the same array until then.
  const domainNow = memo(
    () => [structure?.vertices, binding.byTable, binding.category, options.categories],
    () => domainOf(structure?.vertices ?? [], binding, options.categories),
  );
  /** What is kept, `keptOf`: the one reading every view of the graph draws. */
  const keptNow = memo(
    () => [geometry, mask, snapshot.selection],
    () => keptOf(geometry?.size ?? 0, mask, snapshot.selection?.vertices ?? null, snapshot.selection?.excludes),
  );
  const drawnNow = memo(
    () => [geometry, encoding, keptNow()],
    () => (geometry && encoding ? drawnOf(geometry, encoding, keptNow()) : null),
  );
  const visibleNow = memo(
    () => [keptNow(), geometry],
    () => idsOf(keptNow(), geometry?.positions ?? null),
  );

  function statusOf(): DataStatus {
    if (failed || unrenderable) return "failed";
    if (options.from === null || options.coordinator === null) return "none";
    const current = [geometry, encoding, mask];
    const shown = geometry !== null && current.every((part, i) => part === uploaded[i]);
    if (reads.busy() || !shown) return "loading";
    if (!shownOnce && firstDrawsPending(scope()) > 0) return "loading";
    shownOnce = true;
    return "idle";
  }

  function notify(fields: Partial<GraphSnapshot> = {}): void {
    // The fields first, so a selection among them is what the counts below are counted under.
    snapshot = { ...snapshot, ...fields };
    snapshot = {
      ...snapshot,
      total: structure?.size,
      // What the counts say *match*: kept and placed, `visible()` — a kept vertex with no position is no match.
      matching: visibleNow()?.length ?? null,
      drawn: drawnNow(),
      domain: domainNow(),
      options,
      structure,
      binding,
      geometry,
      encoding,
      kept: keptNow(),
      arrangement,
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

  function read<T>(kind: Kind, ask: (signal: AbortSignal) => Promise<T>, done: (value: T) => void): void {
    reads.run(
      kind,
      ask,
      (value) => {
        done(value);
        notify();
      },
      (error) => {
        failed = true;
        fail(error);
        notify();
      },
    );
  }

  /** Run the first stage the load has not reached: the one that failed, or the one a stop cut short. */
  function resume(): void {
    if (structure === null) loadStructure();
    else if (geometry === null) loadPositions();
    else if (encoding === null) loadChannels();
  }

  function loadStructure(): void {
    const { coordinator, from } = options;
    if (coordinator === null || from === null) return;
    read("structure", (signal) => readCatalog(coordinator, from, signal), (next) => {
      if (next.size === 0) {
        failed = true;
        fail(new Problem("graph/nothing-to-draw", `the corpus attached as ${from} has no vertex`));
        return;
      }
      if (next.size > LIMIT) {
        failed = true;
        fail(new Problem("graph/too-large", `the corpus attached as ${from} has ${next.size} vertices; the graph draws at most ${LIMIT}`, { count: next.size, limit: LIMIT }));
        return;
      }
      structure = next;
      loadPositions();
      client?.requestQuery();
    });
  }

  function loadPositions(): void {
    const { coordinator } = options;
    const given = structure;
    if (coordinator === null || given === null) return;
    read("geometry", (signal) => loadGeometry(coordinator, given, binding, signal), (next) => {
      geometry = next;
      arrangement = null;
      mask = kept ? maskOf(next.size, kept) : null;
      loadChannels();
    });
  }

  function loadChannels(): void {
    const { coordinator } = options;
    const given = geometry;
    if (coordinator === null || given === null) return;
    const seed = domainNow();
    read("encoding", (signal) => loadEncoding(coordinator, given, binding, seed, signal), (next) => {
      encoding = next;
    });
  }

  function reset(): void {
    reads.stop();
    failed = false;
    shownOnce = false;
    // A new corpus: the old one's pick goes from the page with its vertices.
    if (client && published && structure) publish(published, client, structure.key, null, "");
    published = null;
    structure = geometry = encoding = null;
    kept = mask = null;
    arrangement = null;
    uploaded = [];
    notify({ selection: null, focus: null, hovered: null, recent: [] });
    loadStructure();
  }

  /**
   * The graph's Mosaic client, connected to the coordinator while anything is subscribed. The
   * canvas's pick goes with it: withdrawn from the selection the old client published into, and
   * published again from the new one, so a clause never outlives the client it exempts.
   */
  function connect(): void {
    disconnect();
    const { coordinator } = options;
    if (coordinator === null) return;
    client = new GraphClient(
      scope(),
      () => structure,
      (ids) => {
        kept = ids;
        mask = ids && geometry ? maskOf(geometry.size, ids) : null;
        notify();
      },
      // A filter that cannot be answered is a failure, not a picture that claims to be current.
      (error) => {
        failed = true;
        fail(error);
        notify();
      },
      () => {
        if (snapshot.selection === null) return;
        notify({ selection: null });
        options.onSelect?.(null);
      },
    );
    coordinator.connect(client);
    connected = coordinator;
    unwatch = onFirstDraws(scope(), () => notify());
    const { selection } = snapshot;
    if (selection && structure) {
      published = scope();
      publish(published, client, structure.key, selection.vertices, selection.label, selection.excludes);
    }
  }

  function disconnect(): void {
    unwatch?.();
    unwatch = null;
    if (client && published && structure) publish(published, client, structure.key, null, "");
    published = null;
    if (client && connected) connected.disconnect(client);
    client = null;
    connected = null;
  }

  const store: GraphStore = {
    /**
     * The first subscriber connects the client to the coordinator, and the last one disconnects it
     * and lets the graph go — `QueryObserver`'s `onSubscribe`/`onUnsubscribe`, which is what
     * survives StrictMode mounting everything twice.
     */
    subscribe(listener) {
      listeners.add(listener);
      if (!active) {
        active = true;
        connect();
        if (stopped) {
          stopped = false;
          resume();
        }
        if (held !== null) {
          const { error } = held;
          held = null;
          options.onFailure(error);
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
      const before = binding;
      binding = bindingOf(next);
      if (next.from !== previous.from || next.coordinator !== previous.coordinator) {
        if (active && next.coordinator !== previous.coordinator) connect();
        return reset();
      }
      if (active && scope() !== (previous.filterBy ?? own)) connect();
      if (binding.x !== before.x || binding.y !== before.y) loadPositions();
      else if (
        binding.category !== before.category ||
        binding.byTable !== before.byTable ||
        binding.size !== before.size ||
        binding.cluster !== before.cluster ||
        next.categories !== previous.categories
      ) {
        loadChannels();
      }
      notify();
    },
    retry() {
      if (!failed) return;
      reads.stop();
      failed = false;
      resume();
      client?.requestQuery();
      notify();
    },
    destroy() {
      active = false;
      stopped = true;
      reads.stop();
      disconnect();
      listeners.clear();
    },
    visible: visibleNow,
    select(vertices, source = "node", label = "", excludes = false) {
      const selection = vertices && vertices.length > 0 ? { vertices: [...vertices], source, label, excludes } : null;
      notify({ selection });
      options.onSelect?.(selection);
      if (!client || !structure) return;
      published = scope();
      publish(published, client, structure.key, selection ? selection.vertices : null, label, excludes);
    },
    scope,
    source(id) {
      let found = sources.get(id);
      if (!found) sources.set(id, (found = Object.assign(new MosaicClient(), { reset() {}, relation: VERTICES })));
      return found;
    },
    focus(vertex) {
      if (vertex === snapshot.focus) return;
      patch({ focus: vertex });
      options.onFocus?.(vertex);
    },
    hover(vertex) {
      if (vertex !== snapshot.hovered) patch({ hovered: vertex });
    },
    remember(vertex, text) {
      const rest = snapshot.recent.filter((entry) => entry.vertex !== vertex);
      patch({ recent: [{ vertex, text }, ...rest].slice(0, RECENT) });
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
    keep(next) {
      arrangement = next;
      patch({ arrangement });
    },
    renderable() {
      if (!unrenderable) return;
      unrenderable = false;
      notify();
    },
    unrenderable(error) {
      unrenderable = true;
      fail(error);
      notify();
    },
    reportDrawn(drawnSnapshot) {
      // Loading waits on the page's answer, not on the canvas's own clause, which needs no query: a
      // drawing of the current `kept` uploaded the filter it was derived from; an older one, nothing.
      if (drawnSnapshot.kept !== keptNow()) return;
      const next = [drawnSnapshot.geometry, drawnSnapshot.encoding, mask];
      if (next.every((part, i) => part === uploaded[i])) return;
      uploaded = next;
      notify();
    },
  };

  loadStructure();
  notify();
  building = false;
  return store;
}
