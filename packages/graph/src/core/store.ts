import type { Coordinator } from "@kanzo-tech/mosaic";
import { domainOf } from "./categories";
import { bindingOf } from "./channels";
import { GraphClient, publish } from "./client";
import { GraphError } from "./error";
import { loadEncoding, loadGeometry, type Encoding, type Geometry } from "./load";
import { readStructure, type Structure } from "./source";
import type { Drawn, GraphOptions, GraphSnapshot, DataStatus, GraphStore } from "./state";

export type { Drawn, GraphOptions, GraphSnapshot, GraphState, DataStatus, GraphStore } from "./state";

function drawnOf(geometry: Geometry, encoding: Encoding, mask: Uint8Array | null): Drawn {
  const tally = encoding.domain.map(() => 0);
  const shown = new Uint8Array(geometry.size);
  let vertices = 0;
  for (let id = 0; id < geometry.size; id++) {
    if ((mask && !mask[id]) || Number.isNaN(geometry.positions[id * 2])) continue;
    shown[id] = 1;
    vertices++;
    const rank = encoding.ranks[id] as number;
    tally[rank] = (tally[rank] ?? 0) + 1;
  }
  let edges = 0;
  const { links } = geometry;
  for (let i = 0; i < links.length; i += 2) {
    if (shown[links[i] as number] && shown[links[i + 1] as number]) edges++;
  }
  return { vertices, edges, domain: encoding.domain, tally };
}

function matchingOf(mask: Uint8Array | null): number | null {
  if (mask === null) return null;
  let n = 0;
  for (const kept of mask) n += kept;
  return n;
}

/** `1` where a vertex is among `ids`. */
function maskOf(size: number, ids: Float64Array): Uint8Array {
  const mask = new Uint8Array(size);
  for (const id of ids) if (id < size) mask[id] = 1;
  return mask;
}

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();

  let failed = false;
  let unrenderable = false;
  let binding = bindingOf(initial);
  let structure: Structure | null = null;
  let geometry: Geometry | null = null;
  let encoding: Encoding | null = null;
  let kept: Float64Array | null = null;
  let mask: Uint8Array | null = null;
  let uploaded: readonly unknown[] = [];
  /** One read per kind in flight; a newer one makes an older one's answer stale. */
  const reading = { structure: 0, geometry: 0, encoding: 0 };
  const pending = { structure: false, geometry: false, encoding: false };
  let client: GraphClient | null = null;
  let connected: Coordinator | null = null;
  let active = false;

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
    pinned: [],
    tool: null,
    motion: "settled",
    progress: 1,
    options,
    structure: null,
    binding,
    geometry: null,
    encoding: null,
    mask: null,
  };

  let domain: { key: unknown[]; value: readonly unknown[] } = { key: [], value: [] };
  function domainNow(): readonly unknown[] {
    const tables = structure?.vertices ?? [];
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

  function statusOf(): DataStatus {
    if (failed || unrenderable) return "failed";
    if (options.from === null || options.coordinator === null) return "none";
    const current = [geometry, encoding, mask];
    const shown = geometry !== null && current.every((part, i) => part === uploaded[i]);
    return pending.structure || pending.geometry || pending.encoding || !shown ? "loading" : "idle";
  }

  function notify(fields: Partial<GraphSnapshot> = {}): void {
    snapshot = {
      ...snapshot,
      total: structure?.size,
      matching: mask === snapshot.mask ? snapshot.matching : matchingOf(mask),
      drawn: drawnNow(),
      domain: domainNow(),
      options,
      structure,
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
    structure = geometry = encoding = null;
    kept = mask = null;
    uploaded = [];
    notify({ selection: null, focus: null, hovered: null, pinned: [] });
    loadStructure();
  }

  /** The graph's Mosaic client, connected to the coordinator while anything is subscribed. */
  function connect(): void {
    disconnect();
    const { coordinator, filterBy } = options;
    if (coordinator === null) return;
    client = new GraphClient(
      filterBy,
      () => structure,
      (ids) => {
        kept = ids;
        mask = ids && geometry ? maskOf(geometry.size, ids) : null;
        notify();
      },
      (error) => fail(error),
    );
    coordinator.connect(client);
    connected = coordinator;
  }

  function disconnect(): void {
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
      if (active && next.filterBy !== previous.filterBy) connect();
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
    select(vertices, source = "external", label = "") {
      const selection = vertices && vertices.length > 0 ? { vertices: [...vertices], source, label } : null;
      patch({ selection });
      options.onSelect?.(selection);
      if (options.filterBy && client) publish(options.filterBy, client, selection ? selection.vertices : null);
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
