"use client";

import { crossfilterOver, preaggregateOwnRelation, readOf, type JoinGraph, type RelationExpr, type RelationRef, type TableExpr } from "@kanzo-tech/mosaic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ark } from "@ark-ui/react/factory";
import { cn } from "../lib/cn.js";
import {
  coordinator as setActiveCoordinator,
  type Coordinator,
  type Selection,
} from "@uwdata/mosaic-core";

/**
 * MosaicProvider — the page's coordinator, its joins, and the one selection every part on this
 * subpath filters by and publishes into.
 *
 * **Bring-your-own coordinator**, the way CodeEditor is bring-your-own-language. The provider
 * never instantiates a `Coordinator`: the consumer passes one in — `engine()`'s, the page's one
 * DuckDB-WASM database, or one over a socket/REST connector of their own. That keeps the boot out
 * of any React Server Component — it lives in the consumer's `"use client"` island.
 *
 * The provider registers the caller's coordinator as vgplot's active one, so `vg.plot(...)` marks
 * resolve their queries through it, and **owns the page's selection**: one Mosaic crossfilter, built
 * over `joins` (`@kanzo-tech/mosaic`'s `crossfilterOver`), so a clause published on one relation
 * reaches a part reading another — crossed by key along the joins, or keeping none of it where there
 * is no way across. Nobody passes a selection; every part publishes into this one, and a clause is
 * retracted where it is held — `selection.reset([clause])`, which calls its source back.
 */

export interface MosaicContextValue {
  /** The caller-supplied coordinator. Also registered as vgplot's active coordinator. */
  coordinator: Coordinator;
  /**
   * The page's one selection: what every part filters by and publishes into. A chip's × is
   * `selection.reset([clause])`, *Clear* is `selection.reset()`.
   */
  selection: Selection;
  /** The join graph the page's relations are read over, or `null` for a page of plain tables. */
  joins: JoinGraph | null;
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
   * The types and the edges between them that the page's relations are read over —
   * `@kanzo-tech/graph`'s `readJoinGraph` for a fossil corpus. A part's `relation` names a type or a
   * path over them, and a clause on one relation reaches a part on another through them. Without it
   * every relation is a table of its own, and a clause crosses to no other. Keep it stable: a new
   * graph is a new page selection.
   */
  joins?: JoinGraph | null;
  /**
   * Called with the thrown value whenever a chart, a stat or an input under this provider fails to
   * read — the one path a failed query takes to the host. The part also shows the failure in its
   * own frame, so a failed chart is never a blank one.
   */
  onFailure?: (error: unknown) => void;
  children: ReactNode;
}

export function MosaicProvider({ coordinator, joins = null, onFailure, children }: MosaicProviderProps) {
  // Read through a ref, so a host's inline `onFailure` is never a change of context.
  const latest = useRef(onFailure);
  latest.current = onFailure;

  const value = useMemo<MosaicContextValue>(() => {
    // Register the caller's coordinator as vgplot's active one. `coordinator(instance)` is
    // mosaic-core's global setter — the same call a host's boot makes, except the instance
    // arrives as a prop here instead of being built in the library.
    setActiveCoordinator(coordinator);
    // A clause crossed in from another relation is never pre-aggregated against the client's table.
    preaggregateOwnRelation(coordinator);
    return { coordinator, selection: crossfilterOver(joins), joins, onFailure: (error) => latest.current?.(error) };
  }, [coordinator, joins]);

  // The page's slots are the outermost provider's: a provider nested for another relation draws in
  // them too.
  const outer = useContext(Slots);
  const [slot, setSlot] = useState<PageSlots>(EMPTY_SLOTS);
  const slots = useMemo(() => outer ?? { slot, set: setSlot }, [outer, slot]);

  return (
    <MosaicContext.Provider value={value}>
      <Slots.Provider value={slots}>{children}</Slots.Provider>
    </MosaicContext.Provider>
  );
}

/** Clauses a part draws in the bar itself — those on `relation` over one of `fields` — so `FilterBar` does not. */
export interface BarHeld {
  readonly relation: RelationRef | null;
  readonly fields: readonly string[];
}

/**
 * Where the page's `FilterBar` and `TileEditorAside` draw what a dashboard puts in them, whether the
 * bar's clients query, and whether a tile is being edited.
 */
interface PageSlots {
  readonly bar: HTMLElement | null;
  readonly barActions: HTMLElement | null;
  readonly enabled: boolean;
  readonly held: readonly BarHeld[];
  readonly aside: HTMLElement | null;
  readonly editing: boolean;
}

const EMPTY_SLOTS: PageSlots = { bar: null, barActions: null, enabled: true, held: [], aside: null, editing: false };
const Slots = createContext<{ slot: PageSlots; set: (next: (slot: PageSlots) => PageSlots) => void } | null>(null);

/** Sets one of the page's slots, leaving the state alone when it already holds `value`. */
function useSlot<K extends "bar" | "barActions" | "enabled" | "aside" | "editing">(key: K) {
  const set = useContext(Slots)?.set;
  return useCallback((value: PageSlots[K]) => set?.((s) => (s[key] === value ? s : { ...s, [key]: value })), [set, key]);
}

/** The bar's side: its two slots — among its chips and among its actions — and the callback refs that place them. */
export function useBarSlot() {
  const enabled = useContext(Enabled);
  const setEnabled = useSlot("enabled");
  useEffect(() => setEnabled(enabled), [setEnabled, enabled]);
  return { held: useContext(Slots)?.slot.held ?? [], place: useSlot("bar"), placeActions: useSlot("barActions") };
}

/**
 * **Draws `children` in the page's `FilterBar`**, through a portal, so they keep this tree's context
 * — the dashboard's relation — while they sit in the page's bar. `held` names the clauses they draw
 * themselves. They query as the bar does, not as where they are declared, so under a
 * `MosaicClients` that is off — a hidden view — they are drawn and set as when it is shown: its
 * filters reach the page whichever view the reader is in. Nothing is drawn while the page has no bar.
 */
export function InFilterBar({ held, children }: { held: BarHeld; children: ReactNode }) {
  const slots = useContext(Slots);
  const set = slots?.set;
  // By value, so a host's inline relation or array is not a change.
  const key = JSON.stringify(held);
  useEffect(() => {
    if (!set) return;
    const entry = JSON.parse(key) as BarHeld;
    set((s) => ({ ...s, held: [...s.held, entry] }));
    return () => set((s) => ({ ...s, held: s.held.filter((h) => h !== entry) }));
  }, [set, key]);
  return <InBar at="bar">{children}</InBar>;
}

/**
 * **Draws `children` among the page's `FilterBar`'s actions** — after its hairline, before *Clear
 * every filter* — as `InFilterBar` draws among its chips: a dashboard's *Add a filter*. A verb is not
 * a filter, so it stays pinned where the reader found it while the chips scroll.
 */
export function InFilterBarActions({ children }: { children: ReactNode }) {
  return <InBar at="barActions">{children}</InBar>;
}

function InBar({ at, children }: { at: "bar" | "barActions"; children: ReactNode }) {
  const slots = useContext(Slots);
  const element = slots?.slot[at];
  return element
    ? createPortal(<Enabled.Provider value={slots.slot.enabled}>{children}</Enabled.Provider>, element)
    : null;
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
/** The relation the clients under a `MosaicClients` read, as the page knows it. */
const Reading = createContext<RelationRef | null>(null);

export interface MosaicClientsProps {
  /** Whether the clients under it query. A nested `false` wins over an enclosing `true`. Default `true`. */
  enabled?: boolean;
  /**
   * The relation the clients under it read, as the page knows it — a type's name or a path over the
   * provider's joins — when what they are handed to query is SQL over it: a relation projected for
   * the plots, an answer's rows narrowed from it. A clause they publish is on it, and a clause
   * published elsewhere reaches them crossed into it. A part given a `relation` of its own by name or
   * path reads that one instead.
   */
  relation?: RelationRef;
  children: ReactNode;
}

/**
 * **What every client under it is** — Mosaic's `MosaicClient.enabled`, and the relation it reads —
 * for the charts' marks, the inputs and every `useChartQuery`. A disabled client keeps its state and
 * its clauses but asks nothing; enabled again, it runs the one query it was owed. Mosaic's own reason
 * for the flag is ours: a panel that is off screen — a view swapped out, a collapsed dock — keeps what
 * the reader brushed there without re-querying on every pick made elsewhere. Unmounting it instead
 * keeps its clauses — they are the page's (`ClausePlace`) — but asks every query again on its return.
 */
export function MosaicClients({ enabled = true, relation, children }: MosaicClientsProps) {
  const enclosing = useContext(Enabled);
  const reading = useContext(Reading);
  return (
    <Enabled.Provider value={enclosing && enabled}>
      <Reading.Provider value={relation ?? reading}>{children}</Reading.Provider>
    </Enabled.Provider>
  );
}

/** Whether the clients here should query — `MosaicClients`'s answer, `true` outside one. */
export function useClientsEnabled(): boolean {
  return useContext(Enabled);
}

/**
 * What a part pointed at `expr` reads, and the relation the page knows it by: `expr` compiled over the
 * provider's joins when it names a type or a path, or read as written when it is SQL — which is then
 * the relation an enclosing `MosaicClients` names. With no `expr`, the enclosing one's, read by name.
 */
export function useRelation(expr: RelationExpr | undefined): { table: TableExpr | undefined; relation: RelationRef | null } {
  const { joins } = useMosaic();
  const reading = useContext(Reading);
  const key = expr === undefined ? undefined : typeof expr === "string" ? expr : JSON.stringify("root" in expr ? expr : String(expr));
  return useMemo(() => {
    if (expr === undefined) return reading === null ? { table: undefined, relation: null } : readOf(joins, reading);
    const read = readOf(joins, expr);
    return { table: read.table, relation: read.relation ?? reading };
    // `key` stands in for the identity of `expr`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joins, key, reading]);
}

/** The relation the clients here read, by the nearest `MosaicClients`; `null` outside one. */
export function useReading(): RelationRef | null {
  return useContext(Reading);
}

/** The page's Mosaic context — its coordinator, its one selection and its joins. */
export function useMosaic(): MosaicContextValue {
  const ctx = useContext(MosaicContext);
  if (!ctx) throw new Error("useMosaic must be used within a <MosaicProvider>.");
  return ctx;
}
