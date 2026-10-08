"use client";

import { relaySelection } from "@kanzo-tech/mosaic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ark } from "@ark-ui/react/factory";
import { cn } from "../lib/cn.js";
import {
  Selection,
  coordinator as setActiveCoordinator,
  type Coordinator,
  type SelectionClause,
} from "@uwdata/mosaic-core";

/**
 * MosaicProvider — the crossfilter context every chart on this subpath reads from.
 *
 * **Bring-your-own coordinator**, the way CodeEditor is bring-your-own-language. The provider
 * never instantiates a `Coordinator`: the consumer passes one in — `engine()`'s, the page's one
 * DuckDB-WASM database, or one over a socket/REST connector of their own. That keeps the boot out
 * of any React Server Component — it lives in the consumer's `"use client"` island.
 *
 * The provider does two things: it registers the caller's coordinator as vgplot's active one, so
 * `vg.plot(...)` marks resolve their queries through it, and it hands every descendant chart a
 * shared `Selection.crossfilter()` so brushing one chart filters the others.
 */

export interface MosaicContextValue {
  /** The caller-supplied coordinator. Also registered as vgplot's active coordinator. */
  coordinator: Coordinator;
  /** The shared crossfilter selection every chart **filters by**. */
  crossfilter: Selection;
  /**
   * Every clause published by any chart on the page, flattened into one plain union — the page-wide
   * read model, for a filter-chip row or a readout. Relayed into `crossfilter`.
   *
   * It is **not** what a chart highlights by: a page-wide selection names columns other charts
   * group by, and that is a binder error waiting to happen (see `chart-root`). Charts publish into
   * a selection of their own, which converges here.
   */
  selected: Selection;
  /**
   * Enrols a selection in `reset()`. With `relay` (what `ChartRoot` does for the selection it owns)
   * the selection's clauses are also forwarded into `selected`, and from there into `crossfilter`.
   * Returns the unregister.
   */
  registerSelection: (selection: Selection, options?: { relay?: boolean }) => () => void;
  /**
   * Clears every clause on the page — the shared selections **and** every registered chart
   * selection. `Selection.reset()` travels downstream only, so resetting `crossfilter` alone leaves
   * each chart holding its own pick; this is the call a "Clear filters" button wants.
   */
  reset: () => void;
  /**
   * Clears these clauses only — Mosaic's own `Selection.reset(clauses)`, issued on the selection
   * each clause was published into, so it relays down to the crossfilter instead of being removed
   * there and left standing upstream, still highlighting the chart that made it. That is what a
   * filter chip's remove button wants.
   */
  retract: (clauses: readonly SelectionClause[]) => void;
  /** Reports a failed query to the provider's `onFailure`. Every chart part on this subpath calls it. */
  onFailure: (error: unknown) => void;
}

const MosaicContext = createContext<MosaicContextValue | null>(null);

export interface MosaicProviderProps {
  /**
   * The Mosaic `Coordinator`, constructed by the caller over their own DuckDB / connector.
   * The package never builds one — see the module note.
   */
  coordinator: Coordinator;
  /**
   * The crossfilter `Selection` every descendant chart filters by. Defaults to a fresh
   * `Selection.crossfilter()`. Pass one to share a selection across trees or to seed a predicate;
   * everything below still works, because the provider relays into it rather than constructing it.
   */
  crossfilter?: Selection;
  /**
   * Called with the thrown value whenever a chart, a stat or an input under this provider fails to
   * read — the one path a failed query takes to the host. The part also shows the failure in its
   * own frame, so a failed chart is never a blank one.
   */
  onFailure?: (error: unknown) => void;
  children: ReactNode;
}

export function MosaicProvider({ coordinator, crossfilter, onFailure, children }: MosaicProviderProps) {
  // Survives the memo below, so a coordinator swap does not lose the charts already mounted.
  const registry = useRef<Set<Selection> | null>(null);
  registry.current ??= new Set<Selection>();
  // Read through a ref, so a host's inline `onFailure` is never a change of context.
  const latest = useRef(onFailure);
  latest.current = onFailure;

  const value = useMemo<MosaicContextValue>(() => {
    // Register the caller's coordinator as vgplot's active one. `coordinator(instance)` is
    // mosaic-core's global setter — the same call a host's boot makes, except the instance
    // arrives as a prop here instead of being built in the library.
    setActiveCoordinator(coordinator);
    const owned = registry.current as Set<Selection>;
    const selected = Selection.union();
    const shared = crossfilter ?? Selection.crossfilter();
    // The clause objects themselves, so `source` and `clients` survive and the crossfilter still
    // exempts a chart from its own clause. Selections born later (a chart's) are relayed the same way.
    relaySelection(selected, shared);

    return {
      coordinator,
      crossfilter: shared,
      selected,
      registerSelection(selection, options) {
        owned.add(selection);
        if (!options?.relay) return () => void owned.delete(selection);
        const stop = relaySelection(selection, selected);
        return () => {
          owned.delete(selection);
          // The unrelay withdraws the chart's clauses from the page, or a chart that unmounts (a
          // tab, a conditional) would leave them filtering it with nothing on screen to clear them;
          // the reset clears its interactors. Only for selections the root minted — a caller's `as`
          // may well outlive this chart.
          selection.reset();
          stop();
        };
      },
      retract(clauses) {
        // Upstream first: a chart's own selection relays the removal on, so by the time the shared
        // two are asked the clause is usually gone from them already.
        for (const selection of [...owned, selected, shared]) {
          const held = clauses.filter((clause) => selection.clauses.includes(clause));
          if (held.length) selection.reset(held);
        }
      },
      reset() {
        // Children first: each relays its own removal downstream into `selected` and the
        // crossfilter. The two shared resets then take whatever was published straight into them —
        // a `ChartFilter`, a `ChartSearch`, a clause the caller seeded.
        for (const selection of owned) selection.reset();
        selected.reset();
        shared.reset();
      },
      onFailure: (error) => latest.current?.(error),
    };
  }, [coordinator, crossfilter]);

  // The page's slots are the outermost provider's: a provider nested for a dashboard draws in them too.
  const outer = useContext(Slots);
  const [slot, setSlot] = useState<PageSlots>(EMPTY_SLOTS);
  const slots = useMemo(() => outer ?? { slot, set: setSlot }, [outer, slot]);

  return (
    <MosaicContext.Provider value={value}>
      <Slots.Provider value={slots}>{children}</Slots.Provider>
    </MosaicContext.Provider>
  );
}

/** Clauses a part draws in the bar itself — those of `selection` on one of `fields` — so `FilterBar` does not. */
export interface BarHeld {
  readonly selection: Selection;
  readonly fields: readonly string[];
}

/**
 * Where the page's `FilterBar` and `TileEditorAside` draw what a dashboard puts in them, whether the
 * bar's clients query, and whether a tile is being edited.
 */
interface PageSlots {
  readonly bar: HTMLElement | null;
  readonly enabled: boolean;
  readonly held: readonly BarHeld[];
  readonly aside: HTMLElement | null;
  readonly editing: boolean;
}

const EMPTY_SLOTS: PageSlots = { bar: null, enabled: true, held: [], aside: null, editing: false };
const Slots = createContext<{ slot: PageSlots; set: (next: (slot: PageSlots) => PageSlots) => void } | null>(null);

/** Sets one of the page's slots, leaving the state alone when it already holds `value`. */
function useSlot<K extends "bar" | "enabled" | "aside" | "editing">(key: K) {
  const set = useContext(Slots)?.set;
  return useCallback((value: PageSlots[K]) => set?.((s) => (s[key] === value ? s : { ...s, [key]: value })), [set, key]);
}

/** The bar's side: its slot, and the callback ref that places it. */
export function useBarSlot() {
  const enabled = useContext(Enabled);
  const setEnabled = useSlot("enabled");
  useEffect(() => setEnabled(enabled), [setEnabled, enabled]);
  return { held: useContext(Slots)?.slot.held ?? [], place: useSlot("bar") };
}

/**
 * **Draws `children` in the page's `FilterBar`**, through a portal, so they keep this tree's context
 * — the dashboard's provider and its crossfilter — while they sit in the page's bar. `held` names the
 * clauses they draw themselves. They query as the bar does, not as where they are declared: a view
 * hidden by `MosaicClients` still has its filters on screen. Nothing is drawn while the page has no bar.
 */
export function InFilterBar({ held, children }: { held: BarHeld; children: ReactNode }) {
  const slots = useContext(Slots);
  const set = slots?.set;
  const { selection } = held;
  // By value, so a host's inline array is not a change.
  const fields = JSON.stringify(held.fields);
  useEffect(() => {
    if (!set) return;
    const entry: BarHeld = { selection, fields: JSON.parse(fields) as string[] };
    set((s) => ({ ...s, held: [...s.held, entry] }));
    return () => set((s) => ({ ...s, held: s.held.filter((h) => h !== entry) }));
  }, [set, selection, fields]);
  const element = slots?.slot.bar;
  return element ? createPortal(<Enabled.Provider value={slots.slot.enabled}>{children}</Enabled.Provider>, element) : null;
}

/**
 * **Where a dashboard on this page draws its tile editor** — the host's aside, the way draw.io's
 * Format panel is the window's right edge. Place it in your own `ShellAside`, keep it mounted, and
 * show the aside while `useTileEditorOpen()` says a tile is edited. A page without one offers no
 * editing: its dashboards are read-only.
 */
export function TileEditorAside(props: ComponentProps<typeof ark.div>) {
  const { className, slot, ...rest } = props;
  const place = useSlot("aside");
  return <ark.div className={cn("contents", className)} {...rest} data-slot={slot ?? "tile-editor-aside"} ref={place} />;
}

/** Whether a dashboard on this page is editing a tile — when the host shows its `TileEditorAside`. */
export function useTileEditorOpen(): boolean {
  return useContext(Slots)?.slot.editing ?? false;
}

/** The dashboard's side of the aside: the element to draw the editor in, and the call that says a tile is edited. */
export function useEditorAside() {
  return { element: useContext(Slots)?.slot.aside ?? null, edit: useSlot("editing") };
}

const Enabled = createContext(true);

export interface MosaicClientsProps {
  /** Whether the clients under it query. A nested `false` wins over an enclosing `true`. */
  enabled: boolean;
  children: ReactNode;
}

/**
 * **Mosaic's `MosaicClient.enabled`, for every client under it** — the charts' marks, the inputs and
 * every `useChartQuery`. A disabled client keeps its state and its clauses but asks nothing; enabled
 * again, it runs the one query it was owed. Mosaic's own reason for the flag is ours: a panel that
 * is off screen — a view swapped out, a collapsed dock — keeps what the reader brushed there without
 * re-querying on every pick made elsewhere. Unmounting it instead would retract its clauses.
 */
export function MosaicClients({ enabled, children }: MosaicClientsProps) {
  const enclosing = useContext(Enabled);
  return <Enabled.Provider value={enclosing && enabled}>{children}</Enabled.Provider>;
}

/** Whether the clients here should query — `MosaicClients`'s answer, `true` outside one. */
export function useClientsEnabled(): boolean {
  return useContext(Enabled);
}

/** The Mosaic context — coordinator, shared selections, `registerSelection` and `reset`. */
export function useMosaic(): MosaicContextValue {
  const ctx = useContext(MosaicContext);
  if (!ctx) throw new Error("useMosaic must be used within a <MosaicProvider>.");
  return ctx;
}

/** The shared crossfilter `Selection` — what a chart's marks filter by. */
export function useCrossfilter(): Selection {
  return useMosaic().crossfilter;
}

/**
 * Every chart clause on the page in one plain union — a read model, not a publish target. To clear
 * the page use `useMosaic().reset()`: a reset here never reaches the per-chart selections upstream.
 */
export function useSelected(): Selection {
  return useMosaic().selected;
}
