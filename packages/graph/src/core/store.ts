import { MosaicClient, Selection as Crossfilter, type Coordinator } from "@kanzo-tech/mosaic";
import { domainOf } from "./categories";
import { bindingOf } from "./channels";
import { GraphClient, publish } from "./client";
import { GraphError } from "./error";
import { loadEncoding, loadGeometry, type Encoding, type Geometry } from "./load";
import { readStructure } from "./source";
import { type Structure } from "./structure";
import type { VertexId } from "./types";
import { drawnOf, litOf, maskOf, matchingOf, visibleOf } from "./kept";
import type { Arrangement, Drawn, GraphOptions, GraphSnapshot, DataStatus, GraphStore, PickSource } from "./state";

export type { Arrangement, Drawn, GraphOptions, GraphSnapshot, GraphState, DataStatus, GraphStore, View } from "./state";

/** How many vertices `recent` keeps: a palette's short list, not a history. */
const RECENT = 5;

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();

  let failed = false, unrenderable = false, holds = 0; // `holds`: parts the load waits for, `hold()`
  let binding = bindingOf(initial);
  let structure: Structure | null = null;
  let geometry: Geometry | null = null;
  let encoding: Encoding | null = null;
  let kept: Float64Array | null = null;
  let mask: Uint8Array | null = null;
  let arrangement: Arrangement | null = null;
  let uploaded: readonly unknown[] = [];
  /** One read per kind in flight; a newer one makes an older one's answer stale. */
  const reading = { structure: 0, geometry: 0, encoding: 0 };
  const pending = { structure: false, geometry: false, encoding: false };
  let client: GraphClient | null = null;
  let connected: Coordinator | null = null;
  /** Where the client's pick is published, so a reconnect withdraws it from there. */
  let published: Crossfilter | null = null;
  let active = false;
  /** The root's own crossfilter, for a graph no page hands one to. */
  const own = Crossfilter.crossfilter();
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

  let snapshot: GraphSnapshot = {
    status: "none",
    total: undefined,
    matching: null,
    drawn: null,
    domain: [],
    selection: null,
    focus: null,
    hovered: null,
    tool: null,
    motion: "settled",
    progress: 1,
    options,
    structure: null,
    binding,
    geometry: null,
    encoding: null,
    mask: null,
    recent: [],
    arrangement: null,
  };

  let domain: { key: unknown[]; value: readonly unknown[] } = { key: [], value: [] };
  function domainNow(): readonly unknown[] {
    const tables = structure?.vertices ?? [];
    const key = [tables, binding.byTable, binding.category, options.categories];
    if (key.some((part, i) => part !== domain.key[i])) domain = { key, value: domainOf(tables, binding, options.categories) };
    return domain.value;
  }

  /** What is in full colour as a mask: the page's filter narrowed to the canvas's own pick. */
  let lit: { key: unknown[]; value: Uint8Array | null } = { key: [], value: null };
  function litNow(): Uint8Array | null {
    const key = [geometry, mask, snapshot.selection];
    if (key.some((part, i) => part !== lit.key[i])) {
      lit = { key, value: litOf(geometry?.size ?? 0, mask, snapshot.selection?.vertices ?? null) };
    }
    return lit.value;
  }

  let drawn: { key: unknown[]; value: Drawn | null } = { key: [], value: null };
  function drawnNow(): Drawn | null {
    const shown = litNow();
    const key = [geometry, encoding, shown];
    if (key.some((part, i) => part !== drawn.key[i])) {
      drawn = { key, value: geometry && encoding ? drawnOf(geometry, encoding, shown) : null };
    }
    return drawn.value;
  }

  let visible: { key: unknown[]; value: readonly VertexId[] | null } = { key: [], value: null };
  function visibleNow(): readonly VertexId[] | null {
    const key = [geometry, mask, snapshot.selection];
    if (key.some((part, i) => part !== visible.key[i])) {
      visible = { key, value: visibleOf(geometry?.size ?? 0, mask, snapshot.selection?.vertices ?? null) };
    }
    return visible.value;
  }

  function statusOf(): DataStatus {
    if (failed || unrenderable) return "failed";
    if (options.from === null || options.coordinator === null) return "none";
    const current = [geometry, encoding, mask];
    const shown = geometry !== null && current.every((part, i) => part === uploaded[i]);
    return pending.structure || pending.geometry || pending.encoding || !shown || holds > 0 ? "loading" : "idle";
  }

  function notify(fields: Partial<GraphSnapshot> = {}): void {
    // The fields first, so a selection among them is what the counts below are counted under.
    snapshot = { ...snapshot, ...fields };
    snapshot = {
      ...snapshot,
      total: structure?.size,
      matching: matchingOf(litNow()),
      drawn: drawnNow(),
      domain: domainNow(),
      options,
      structure,
      binding,
      geometry,
      encoding,
      mask,
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

  /**
   * Read `kind`, and keep the answer only if no newer read of the same kind started meanwhile. The
   * coordinator cannot be told to stop a statement, so a stale answer is dropped rather than aborted.
   */
  function read<T>(kind: keyof typeof reading, ask: () => Promise<T>, done: (value: T) => void): void {
    const ticket = ++reading[kind];
    pending[kind] = true;
    ask().then(
      (value) => {
        if (reading[kind] !== ticket) return;
        pending[kind] = false;
        done(value);
        notify();
      },
      (error: unknown) => {
        if (reading[kind] !== ticket) return;
        pending[kind] = false;
        failed = true;
        fail(error);
        notify();
      },
    );
  }

  function loadStructure(): void {
    const { coordinator, from } = options;
    if (coordinator === null || from === null) return;
    read("structure", () => readStructure(coordinator, from), (next) => {
      if (next.size === 0) {
        failed = true;
        fail(new GraphError("graph/nothing-to-draw", `the corpus attached as ${from} has no vertex`));
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
    read("geometry", () => loadGeometry(coordinator, given, binding), (next) => {
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
    read("encoding", () => loadEncoding(coordinator, given, binding, seed), (next) => {
      encoding = next;
    });
  }

  function reset(): void {
    for (const kind of Object.keys(reading) as (keyof typeof reading)[]) {
      reading[kind]++;
      pending[kind] = false;
    }
    failed = false;
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
      (error) => fail(error),
      () => {
        if (snapshot.selection === null) return;
        notify({ selection: null });
        options.onSelect?.(null);
      },
    );
    coordinator.connect(client);
    connected = coordinator;
    const { selection } = snapshot;
    if (selection && structure) {
      published = scope();
      publish(published, client, structure.key, selection.vertices, selection.label);
    }
  }

  function disconnect(): void {
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
    destroy() {
      active = false;
      disconnect();
      listeners.clear();
    },
    visible: visibleNow,
    select(vertices, source = "node", label = "") {
      const selection = vertices && vertices.length > 0 ? { vertices: [...vertices], source, label } : null;
      notify({ selection });
      options.onSelect?.(selection);
      if (!client || !structure) return;
      published = scope();
      publish(published, client, structure.key, selection ? selection.vertices : null, label);
    },
    scope,
    source(id) {
      let found = sources.get(id);
      if (!found) sources.set(id, (found = Object.assign(new MosaicClient(), { reset() {} })));
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
    hold() {
      let held = (holds++, notify(), true);
      return () => void (held && ((held = false), holds--, notify()));
    },
    reportDrawn(drawnSnapshot) {
      const next = [drawnSnapshot.geometry, drawnSnapshot.encoding, drawnSnapshot.mask];
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
