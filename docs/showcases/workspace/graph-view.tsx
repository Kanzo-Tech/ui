"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseDate, type DateValue } from "@internationalized/date";
import { clausePoints } from "@uwdata/mosaic-core";
import { desc, sql } from "@uwdata/mosaic-sql";
import {
  Badge,
  Button,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  createListCollection,
  Kbd,
  KbdGroup,
  PreferencesFieldSet,
  ScrollArea,
  Show,
  Status,
  Skeleton,
  Slider,
  SuggestContent,
  SuggestRoot,
  SuggestTrigger,
  Swatch,
  Switch,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  useFilter,
  useListCollection,
  useChartCapacity,
  type Suggestion,
} from "@kanzo-tech/ui";
import {
  Query,
  chartSeriesColor,
  count,
  useChartQuery,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import {
  CrosshairIcon,
  MaximizeIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  PlusIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@kanzo-tech/ui";
import {
  compileOrders,
  DEFAULT_ORDERS,
  type Order,
  pathDatatype,
  type Severity,
  SUPPORTED_PATHS,
  SUPPORTED_TARGETS,
} from "./orders";
import {
  CONSTRAINT_KINDS,
  type ConstraintKind,
  isValidValue,
  members,
  parseRules,
  type Rule,
  ruleFrom,
  toOrders,
} from "./order-builder";
import { numbers } from "@/lib/arrow";
import { HALLS, isoDay } from "@/example/world";
import {
  ARCHIVE_SPEC,
  DEFAULT_DISPLAY,
  DEFAULT_SIM,
  EDGES,
  KINDS,
  NODES,
  useGraphView,
  type Motion,
} from "./graph-state";
import {
  denseOf,
  LOOKS,
  LOOK_ORDER,
  scaleOf,
  vertexId,
} from "@kanzo-tech/graph";
// `onceQuery` is on the DuckDB subpath, not the barrel: it is a Mosaic client, and the barrel
// must stay importable without Mosaic installed.
import { onceQuery } from "@kanzo-tech/graph/duckdb";
import type { NodeKind } from "./graph-data";
import { ShapeGlyph, text } from "./graph-canvas";
import { Finding } from "./graph-finding";

/**
 * The panels around the canvas.
 *
 * Every number any of them shows is a query against the same two relations, and every selection any
 * of them makes is a clause in the same crossfilter — which is why none of them imports the canvas,
 * or needs to know that a graph is what the selection is being drawn on.
 */

export { GraphMosaic, KINDS } from "./graph-state";
export { GraphCanvas, GraphSelection, GraphToolbar, GraphZoom } from "./graph-canvas";

// A SHACL bound is a plain ISO string — that is what compiles to SQL and what a Turtle document
// carries — while `DatePicker` speaks `DateValue`. These two are the whole seam.
function toDateValues(iso: string | null): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDate(iso)];
  } catch {
    return [];
  }
}

function IsoDateInput({
  "aria-label": ariaLabel,
  invalid,
  onChange,
  value,
}: {
  "aria-label"?: string;
  invalid?: boolean;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  return (
    <DatePicker
      onValueChange={(details) => onChange(details.valueAsString[0] ?? null)}
      positioning={{ placement: "bottom-end" }}
      value={toDateValues(value)}
    >
      <DatePickerInput aria-invalid={invalid || undefined} aria-label={ariaLabel} />
      <DatePickerContent>
        <CalendarView view="day">
          <CalendarViewControl>
            <CalendarPrevTrigger />
            <CalendarMonthSelect />
            <CalendarYearSelect />
            <CalendarNextTrigger />
          </CalendarViewControl>
          <CalendarTable>
            <CalendarWeekDays />
            <CalendarTableDays />
          </CalendarTable>
        </CalendarView>
      </DatePickerContent>
    </DatePicker>
  );
}

// ── Legend and counts ────────────────────────────────────────────────────────

/** The legend draws the glyph the canvas draws, so a look that encodes kind as shape stays legible. */
/**
 * The domain the swatches are drawn against — **sorted**, and that is not a tidy-up.
 *
 * A slice carries category *ordinals*, not names, and the ordinal is whatever the source ranked the
 * column into: `dense_rank() OVER (ORDER BY kind)`, which is alphabetical. `KINDS` is the fixture's
 * declared order, and the two are not the same list — this corpus has six kinds and `member` sits
 * fifth here and third alphabetically. Left unsorted this legend would name colours the canvas gives
 * to different kinds.
 *
 * The gap the old comment called hypothetical — the cross-panel binding problem, Vega-Lite's
 * `resolve: {scale: {color: shared}}` — is now load-bearing, because the binding is a number crossing
 * a query boundary rather than a string both sides happen to agree on. Sorting is the whole of the
 * agreement: the source ranks by value, so the domain is the distinct values in that same order.
 */
const LEGEND_DOMAIN = Object.keys(KINDS).sort();

/** A category name to the ordinal the canvas knows it by. `-1` for a kind the corpus does not hold. */
const ordinalOf = (kind: string): number => LEGEND_DOMAIN.indexOf(kind);

function LegendSwatch({ kind }: { kind: string }) {
  const { look } = useGraphView();
  const capacity = useChartCapacity();
  const scale = scaleOf(LOOKS[look], capacity);
  return (
    <ShapeGlyph
      color={scale.color(ordinalOf(kind))}
      shape={scale.shape(ordinalOf(kind))}
    />
  );
}

function LegendRows() {
  const { rows } = useChartQuery({
    query: (filter) =>
      Query.from(NODES).select({ kind: "kind", n: count() }).where(filter).groupby("kind"),
  });
  const tally = new Map((rows ?? []).map((row) => [String(row.kind), Number(row.n)]));

  return (
    <ul className="space-y-1">
      {Object.entries(KINDS).map(([kind, series]) => (
        <li className="flex items-center gap-2 text-xs" key={kind}>
          <LegendSwatch kind={kind} />
          <span>{series.label}</span>
          <span className="ms-auto ps-4 text-muted-foreground tabular-nums">
            {rows === null ? "—" : (tally.get(kind) ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GraphLegend() {
  const { ready } = useGraphView();
  // Solid, like the rest of the canvas chrome: `bg-card/80` measured a ΔE 12.6–14.0 spread across
  // the plane and the eight slots, so the legend's own surface changed colour with whatever the
  // layout parked behind it.
  return (
    <div className="absolute bottom-2 start-2 z-10 rounded-md border bg-card px-2.5 py-1.5">
      {ready ? (
        <LegendRows />
      ) : (
        <ul className="space-y-1">
          {Object.entries(KINDS).map(([kind, series]) => (
            <li className="flex items-center gap-2 text-xs" key={kind}>
              <LegendSwatch kind={kind} />
              <span>{series.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Live totals against the whole corpus — "of" is the crossfilter, not a guess. */
function CountRow() {
  const nodes = useChartQuery({
    query: (filter) => Query.from(NODES).select({ n: count() }).where(filter),
  });
  const total = useChartQuery({
    filterBy: null,
    query: () => Query.from(NODES).select({ n: count() }),
  });
  const edges = useChartQuery({
    query: (filter) => Query.from(EDGES).select({ n: count() }).where(filter),
  });

  const shown = Number(nodes.row?.n ?? 0);
  const all = Number(total.row?.n ?? 0);
  const links = Number(edges.row?.n ?? 0);
  if (total.rows === null) return <>Loading the corpus…</>;

  return (
    <>
      {shown === all ? all.toLocaleString() : `${shown.toLocaleString()} of ${all.toLocaleString()}`}{" "}
      nodes · {links.toLocaleString()} edges
    </>
  );
}

/**
 * The layout's state, as one badge.
 *
 * All three states are named. A converged layout and a paused one are the same still picture, so
 * leaving either unlabelled — or only ever showing "settling…" — makes the canvas ambiguous exactly
 * when the reader is wondering whether it is stuck.
 */
const MOTION: Record<Motion, { dot: "info" | "success" | "warning"; label: string }> = {
  running: { dot: "info", label: "Settling" },
  settled: { dot: "success", label: "Settled" },
  paused: { dot: "warning", label: "Paused" },
};

export function MotionBadge({ className }: { className?: string }) {
  const { motion, progress, ready } = useGraphView();
  if (!ready) return null;
  const state = MOTION[motion];
  return (
    <Badge className={cn("gap-1.5", className)} size="xs" variant="outline">
      <Status
        className={cn("ring-0", motion === "running" && "animate-pulse")}
        size="sm"
        variant={state.dot}
      />
      {state.label}
      {/* Determinate, because cosmos.gl already computes it: `graph.progress` is
          `√(ALPHA_MIN / alpha)`, so this is the layout's own account of how far it has cooled and
          not a guess from elapsed time. Only while running — a settled or paused graph is at a
          state, not a fraction. */}
      <Show when={motion === "running"}>
        <span className="tabular-nums">{Math.round(progress * 100)}%</span>
      </Show>
    </Badge>
  );
}

export function GraphCounts() {
  const { ready } = useGraphView();
  return (
    <span className="flex items-center gap-2 px-1 text-muted-foreground text-xs tabular-nums">
      <span>{ready ? <CountRow /> : "Loading the corpus…"}</span>
      <MotionBadge />
    </span>
  );
}

// ── Inspector ────────────────────────────────────────────────────────────────

interface NodeRow {
  id: number;
  label: string;
  kind: string;
  hall: string;
  region: string;
  signed: string;
  degree: number;
  closed: string;
  tags: string;
}

const COLUMNS = {
  id: "id",
  label: "label",
  kind: "kind",
  hall: "hall",
  region: "region",
  signed: "signed",
  degree: "degree",
  closed: "closed",
  tags: "tags",
};

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: `closed` is a CSV column DuckDB
 * infers as DATE, so Arrow returns a `Date` object, and rendering one crashes React with "Objects
 * are not valid as a React child". Anything coming out of a query is formatted before it is shown.
 */
/**
 * What a node carries, named the way the standing orders name it.
 *
 * These are the property names in `ARCHIVE_BINDING`, not prettier ones invented for the panel: a
 * reader who sees `signed` here and writes `require signed at least 1` in the orders is talking
 * about the same thing, and that is the entire reason the inspector is worth reading beside the
 * Orders tab.
 */
function properties(node: NodeRow): { predicate: string; value: string }[] {
  const rows = [{ predicate: "kind", value: text(node.kind) }];
  if (node.hall) rows.push({ predicate: "hall", value: hallName(text(node.hall)) });
  if (node.region) rows.push({ predicate: "region", value: text(node.region) });
  if (node.signed) rows.push({ predicate: "signed", value: text(node.signed) });
  if (node.closed) rows.push({ predicate: "closed", value: text(node.closed) });
  if (node.tags) rows.push({ predicate: "tags", value: text(node.tags).split("|").join(", ") });
  rows.push({ predicate: "links", value: text(node.degree) });
  return rows;
}

/** A hall id is what the relation stores; a hall's short name is what a reader knows it by. */
function hallName(id: string): string {
  return HALLS.find((entry) => entry.id === id)?.short ?? id;
}

function InspectorBody() {
  const { commands, focused } = useGraphView();

  const selection = useChartQuery({
    query: (filter) =>
      Query.from(NODES).select(COLUMNS).where(filter).orderby(desc("degree"), "label").limit(12),
  });
  // A clicked node outranks the selection's head. Clicking publishes the node *and its
  // neighbours*, and among those the reader's node is rarely the one with the highest degree — so
  // ordering alone would answer a different question than the one the click asked.
  const clicked = useChartQuery({
    filterBy: null,
    deps: [focused],
    query: () =>
      focused === null ? null : Query.from(NODES).select(COLUMNS).where(`id = ${denseOf(focused)}`),
  });

  const rows = selection.rows;
  if (rows === null) return <Skeleton className="h-24 w-full" />;
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-xs">Nothing in the current selection.</p>;
  }

  const all = rows as unknown as NodeRow[];
  const pinned = (clicked.row as unknown as NodeRow | undefined) ?? null;
  const head = pinned ?? all[0];
  if (!head) return null;
  const rest = all.filter((node) => node.id !== head.id);

  return (
    <div className="space-y-3">
      <div>
        <p className="truncate font-medium text-sm">{head.label}</p>
        {/* Where it sits, which is the one thing the badge below cannot say: a contract and the
            reports hanging off it belong to a hall's arc, and everything the halls share belongs to
            none — which is why those drift between the arcs they join. */}
        <p className="mt-0.5 text-muted-foreground text-xs">
          {head.hall ? hallName(head.hall) : "shared across the halls"}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge className="text-[10px]" size="xs" variant="outline">
            {KINDS[head.kind]?.label ?? head.kind}
          </Badge>
          {/* "Reveal" said nothing about what it reveals or where. It moves the CAMERA: the node
              is already on screen somewhere, and this brings it into view. */}
          <Button
            className="h-5 gap-1 text-[10px]"
            onClick={() => commands.reveal(vertexId(ARCHIVE_SPEC.typeIndex, head.id))}
            size="sm"
            title="Bring this node into view on the canvas"
            variant="ghost"
          >
            <CrosshairIcon className="size-3" />
            Find on canvas
          </Button>
        </div>
      </div>
      <dl className="space-y-2 text-sm">
        {properties(head).map((p) => (
          <div className="flex flex-col gap-0.5" key={p.predicate}>
            <dt className="font-medium text-muted-foreground text-xs">{p.predicate}</dt>
            <dd className="break-all">{p.value}</dd>
          </div>
        ))}
      </dl>
      <Show when={rest.length > 0}>
        <div className="border-t pt-2">
          <p className="mb-1 font-medium text-muted-foreground text-xs">
            {pinned ? "Connected to it" : "Also in this selection"}
          </p>
          <ul className="space-y-0.5">
            {rest.map((node) => (
              <li key={node.id}>
                <button
                  // `hover:bg-accent/60` composited to `--secondary` exactly (ΔE 0.00, both
                  // modes): the row hover was the hover surface written as a coincidence.
                  //
                  // `min-h-[24px]` is in PIXELS on purpose, and it is the whole fix. WCAG 2.5.8
                  // states its 24×24 bar in CSS px, while every size in this library is `rem` and
                  // therefore multiplied by the density axis — so a floor written `min-h-6` would
                  // be 24px at the default root and 21px at compact, which is the failure rather
                  // than the fix. Measured before: 20.0px tall at default and 17.5 at compact,
                  // centres 22.0 and 19.3 apart, failing 2.5.8 AA at two of the three densities.
                  // A px floor is the one size in this file that must NOT scale, because the bar
                  // it answers to does not. `decisions/density-has-no-legibility-floor.md`.
                  className="flex min-h-[24px] w-full items-center gap-2 rounded-sm px-1 py-0.5 text-start text-xs hover:bg-accent"
                  onClick={() => commands.reveal(vertexId(ARCHIVE_SPEC.typeIndex, node.id))}
                  type="button"
                >
                  <Swatch
                    className="size-1.5"
                    color={chartSeriesColor(KINDS, node.kind) ?? "transparent"}
                    shape="round"
                  />
                  <span className="truncate">{node.label}</span>
                  <span className="ms-auto ps-2 text-muted-foreground tabular-nums">
                    {node.degree}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Show>
    </div>
  );
}

/** The Info tab: a real search over `label`, and the current selection ranked by degree. */
/**
 * Find one thing in the archive and select it.
 *
 * Not `ChartSearch`, and the difference is what the control MEANS. `ChartSearch` publishes a
 * `clauseMatch` — a substring filter over a column — and offers completions through a native
 * `<datalist>`. That is the right instrument for "narrow this to everything mentioning the weir",
 * and the wrong one for "take me to this node": a datalist cannot be styled, differs in every
 * browser, has no empty state, shows no context beside a value, and silently stops at its limit.
 *
 * Picking is a value, so this is a `Combobox`, and what it publishes is that node's id — the
 * canvas lights it up, the panel below describes it, and the footer retallies. The list is capped
 * and SAYS it is capped, which is the part the datalist could not do.
 */
const SEARCH_LIMIT = 50;

function ArchiveSearch() {
  const { crossfilter } = useMosaic();
  const source = useRef({ shape: "archive-search" });

  // The whole corpus, once, against no filter: a search that only finds what is already on screen
  // cannot take you anywhere. 1,543 rows is small enough to filter in the browser; a real archive
  // would query per keystroke instead.
  const { rows } = useChartQuery({
    filterBy: null,
    query: () =>
      Query.from(NODES).select({ id: "id", label: "label", kind: "kind" }).orderby(desc("degree")),
  });

  const items = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        label: String(row.label),
        value: String(row.id),
        kind: String(row.kind),
      })),
    [rows],
  );

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter, set } = useListCollection({
    filter: contains,
    initialItems: items,
    limit: SEARCH_LIMIT,
  });

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || items.length === 0) return;
    loaded.current = true;
    set(items);
  }, [items, set]);

  return (
    <Combobox
      collection={collection}
      onInputValueChange={(details) => filter(details.inputValue)}
      onValueChange={(details) => {
        const picked = details.value[0];
        crossfilter.update(
          clausePoints(["id"], picked ? [[Number(picked)]] : undefined, {
            source: source.current,
          }),
        );
      }}
    >
      <ComboboxInput placeholder="Find anything in the archive…" size="sm" />
      <ComboboxContent>
        <ComboboxEmpty>Nothing by that name.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="ms-auto ps-2 text-muted-foreground text-xs">
              {KINDS[item.kind as NodeKind]?.label ?? item.kind}
            </span>
          </ComboboxItem>
        ))}
        <Show when={collection.items.length >= SEARCH_LIMIT}>
          <p className="border-t px-2 py-1.5 text-muted-foreground text-xs">
            First {SEARCH_LIMIT}. Keep typing to narrow it.
          </p>
        </Show>
      </ComboboxContent>
    </Combobox>
  );
}

export function GraphInspector() {
  const { ready } = useGraphView();
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-2">
        {ready ? (
          <ArchiveSearch />
        ) : (
          <InputGroup data-disabled size="sm">
            <InputGroupAddon align="inline-start">
              <SearchIcon className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput disabled placeholder="Search the archive…" size="sm" />
          </InputGroup>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        {ready ? <InspectorBody /> : <Skeleton className="h-24 w-full" />}
      </ScrollArea>
    </div>
  );
}

// ── Standing orders ──────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<Severity, string> = {
  violation: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

/** What a value looks like for each constraint — the placeholder does the explaining. */
const VALUE_HINT: Record<ConstraintKind, string> = {
  "at least": "1",
  "at most": "5",
  "not before": "1305-01-01",
  "not after": "1312-09-14",
  "one of": "warden, archivist",
  matches: "^Wyrm",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  violation: "Violation",
  warning: "Warning",
  info: "Info",
};

// Built once, outside the component: a collection rebuilt every render gives the Select a new
// identity on each keystroke elsewhere in the panel.
const of = (values: readonly string[], label: (v: string) => string = (v) => v) =>
  createListCollection({ items: values.map((value) => ({ label: label(value), value })) });

const TARGETS_LIST = of(SUPPORTED_TARGETS);
const PATHS_LIST = of(SUPPORTED_PATHS);
const KINDS_LIST = of(CONSTRAINT_KINDS);
const SEVERITY_LIST = of(
  Object.keys(SEVERITY_LABEL) as Severity[],
  (v) => SEVERITY_LABEL[v as Severity],
);

/** One row of the sentence: a connective and the control that completes it. */
function RulePart({
  children,
  collection,
  label,
  mono = true,
  onChange,
  value,
}: {
  children?: React.ReactNode;
  collection: ReturnType<typeof of>;
  label: string;
  /** The terms are the document's own words; the severity is a plain English one. */
  mono?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-16 shrink-0 text-end text-muted-foreground text-xs">{label}</span>
      <Select
        className="min-w-0 flex-1"
        collection={collection}
        onValueChange={(details) => details.value[0] && onChange(details.value[0])}
        positioning={{ sameWidth: true }}
        value={[value]}
      >
        {/* Mono for the term, sans for the connective: a property is a word out of the document and
            the list below already sets it that way, so a sans-serif `closed` in the form and a mono
            one in the list read as two different things. */}
        <SelectTrigger aria-label={label} className={cn("h-8 w-full text-xs", mono && "font-mono")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {collection.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children}
    </div>
  );
}

/**
 * The order builder — menus in, standing orders out.
 *
 * It has no model of its own: it appends an `order` block to the document the panel already
 * compiles, so an order you pick from these menus and an order you dropped on the panel are the same
 * thing by the time anything downstream sees either. The menus offer only what `./orders` can map,
 * which is why a built order always compiles.
 */
function OrderBuilder({
  rules,
  onAdd,
}: {
  rules: Rule[];
  onAdd: (rule: Omit<Rule, "id" | "name" | "message">) => void;
}) {
  const [target, setTarget] = useState(SUPPORTED_TARGETS[0] ?? "contract");
  const [path, setPath] = useState(SUPPORTED_PATHS[0] ?? "closed");
  const [kind, setKind] = useState<ConstraintKind>("at least");
  const [value, setValue] = useState("1");
  const [severity, setSeverity] = useState<Severity>("violation");

  // One constraint of a kind per property, because that is all the document can say apart: a second
  // `at least` on the same property would compile to an order with the same identity as the first.
  const duplicate = rules.some(
    (rule) => rule.target === target && rule.path === path && rule.kind === kind,
  );
  // Two different reasons Add can be off, and the field only owns one of them: marking the value
  // invalid because the PROPERTY already has this constraint would blame the wrong control.
  const valueOk = isValidValue(kind, value);
  const valid = valueOk && !duplicate;
  /** A bound on a date column is a date — the only place the control needs the property's datatype. */
  const isDateBound =
    pathDatatype(path) === "date" && (kind === "not before" || kind === "not after");

  return (
    <div className="space-y-1.5 border-t pt-3">
      <p className="font-medium text-muted-foreground text-xs">Add an order</p>
      {/* Read as the sentence an order actually is — every X must have Y, so-and-so — rather than
          as five unlabelled dropdowns. The connectives carry the labelling, which is why the
          controls only need `aria-label`: in a 320px dock a label column would leave nothing for
          the values. */}
      {/* `bg-muted/24` and the source view's `bg-muted/40` composited to ΔE 0.30 (light) / 0.46
          (dark) of *each other* and within ΔE 1.4 of the card — two numbers for one colour, and
          that colour was the surface underneath. Solid `--muted` is step 3, a component's normal
          surface, and clears the card by ΔE 3.30 / 3.22. */}
      <div className="space-y-1.5 rounded-md border bg-muted p-2">
        <RulePart collection={TARGETS_LIST} label="Every" onChange={setTarget} value={target} />
        <RulePart collection={PATHS_LIST} label="must have" onChange={setPath} value={path} />
        <RulePart
          collection={KINDS_LIST}
          label="checked by"
          onChange={(next) => {
            setKind(next as ConstraintKind);
            setValue(VALUE_HINT[next as ConstraintKind]);
          }}
          value={kind}
        />
        <div className="flex items-start gap-1.5">
          <span className="mt-1.5 w-16 shrink-0 text-end text-muted-foreground text-xs">
            against
          </span>
          {/* The control follows the constraint AND the property, because between them they decide
              what a value IS. `one of` is a set, so it gets tags rather than a line of text with
              commas in it; a bound on a date column is a date; a count is a number with steppers.
              Typing "1312-13-01" into a text box and finding out from DuckDB is the version of this
              the panel used to have. */}
          <div className="min-w-0 flex-1">
            {kind === "one of" ? (
              <TagsInput
                invalid={!valueOk}
                onValueChange={(details) => setValue(details.value.join(", "))}
                value={members(value)}
              >
                <TagsInputControl>
                  <TagsInputContext>
                    {(api) =>
                      api.value.map((entry, index) => (
                        <TagsInputItem index={index} key={`${entry}-${index}`} value={entry}>
                          <TagsInputItemPreview>
                            <TagsInputItemText>{entry}</TagsInputItemText>
                            <TagsInputItemDeleteTrigger />
                          </TagsInputItemPreview>
                          <TagsInputItemInput />
                        </TagsInputItem>
                      ))
                    }
                  </TagsInputContext>
                  <TagsInputInput placeholder="add a value…" />
                </TagsInputControl>
              </TagsInput>
            ) : isDateBound ? (
              <IsoDateInput
                aria-label="Value"
                invalid={!valueOk}
                onChange={(next) => setValue(next ?? "")}
                value={value}
              />
            ) : kind === "at least" || kind === "at most" ? (
              <Input
                aria-invalid={!valueOk || undefined}
                aria-label="Value"
                className="h-8 w-full font-mono text-xs"
                inputMode="decimal"
                min={0}
                onChange={(e) => setValue(e.target.value)}
                placeholder={VALUE_HINT[kind]}
                type="number"
                value={value}
              />
            ) : (
              <Input
                aria-invalid={!valueOk || undefined}
                aria-label="Value"
                className="h-8 w-full font-mono text-xs"
                onChange={(e) => setValue(e.target.value)}
                placeholder={VALUE_HINT[kind]}
                value={value}
              />
            )}
          </div>
        </div>
        <RulePart
          collection={SEVERITY_LIST}
          label="or it is a"
          mono={false}
          onChange={(next) => setSeverity(next as Severity)}
          value={severity}
        />

        <Button
          className="w-full gap-1"
          disabled={!valid}
          onClick={() => onAdd({ target, path, kind, value, severity })}
          size="sm"
          variant="secondary"
        >
          <PlusIcon className="size-3.5" />
          Add
        </Button>

        <Show when={duplicate}>
          <p className="text-warning text-xs">
            The orders already hold “{kind}” on {target} {path}.
          </p>
        </Show>
      </div>
    </div>
  );
}

/**
 * The Orders panel — the hall's standing orders, compiled to SQL, with the graph as the report.
 *
 * The orders are not a constant in this file: they are a document in the world's own rule language
 * — the one `@/example/rules` writes the board's copy in — parsed and compiled by `./orders`, and
 * you can drop your own over it. That is what makes the panel an archivist rather than a picture of
 * one: the same file, pointed at another binding, reads another relation.
 *
 * A report is a list of counts, which is a list of `count(*) FILTER (WHERE …)`, which is one query.
 * And focusing an order queries the ids that break it and publishes them into the crossfilter, so
 * the canvas lights up exactly the offending nodes, the legend retallies by kind and the inspector
 * ranks them — the panel does not draw anything or know those exist.
 *
 * The counts are read against the whole corpus (`filterBy: null`), not the current view: a report
 * that changed as you browsed would be a different question every time you looked.
 */
export function GraphOrders() {
  const { ready } = useGraphView();
  if (!ready) {
    return (
      <div className="p-3">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <OrdersBody />;
}

function OrdersBody() {
  const { select } = useGraphView();
  const { coordinator } = useMosaic();
  const [source, setSource] = useState(DEFAULT_ORDERS);
  const [fileName, setFileName] = useState("amber-hall.orders");
  const [showSource, setShowSource] = useState(false);

  const { orders, unsupported, errors } = useMemo(() => compileOrders(source), [source]);

  // The same document, read as rules the builder can write back. `exact` is what makes editing
  // safe: regenerating the file drops whatever the builder could not read, so when anything would
  // be lost the panel stays read-only and says what it is protecting.
  const { rules, exact, lost } = useMemo(() => parseRules(source), [source]);

  /** An order that no longer exists must not keep lighting up nodes. */
  const unfocus = () => select(null);

  const addRule = (draft: Omit<Rule, "id" | "name" | "message">) => {
    unfocus();
    setSource(toOrders([...rules, ruleFrom(draft)]));
  };

  const removeRule = (id: string) => {
    unfocus();
    setSource(toOrders(rules.filter((rule) => rule.id !== id)));
  };

  // Every order's failing count, in one pass over the relation.
  const { row } = useChartQuery({
    filterBy: null,
    deps: [orders.map((s) => s.id).join("|")],
    query: () =>
      orders.length === 0
        ? null
        : // `sql` nests the compiler's predicate as a node rather than pasting its text: the
          // aggregate is the only SQL written here, and `s.failing` arrives already built.
          Query.from(NODES).select(
            Object.fromEntries(
              orders.map((s, i) => [`c${i}`, sql`count(*) FILTER (WHERE ${s.failing})`]),
            ),
          ),
  });

  const countOf = (i: number) => Number(row?.[`c${i}`] ?? 0);
  /** No row yet: the counts are being queried, not zero. */
  const pending = row === undefined;
  const total = (severity: Severity) =>
    orders.reduce((n, s, i) => (s.severity === severity ? n + countOf(i) : n), 0);
  const violations = total("violation");
  const warnings = total("warning");

  const failingIds = async (order: Order) => {
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ id: "id" }).where(order.failing),
    );
    return numbers(data, "id");
  };

  const load = async (file: File) => {
    unfocus();
    setFileName(file.name);
    setSource(await file.text());
  };

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-3">
        <FileUpload
          accept=".orders,text/plain"
          maxFiles={1}
          onFileAccept={(details) => {
            const file = details.files[0];
            if (file) void load(file);
          }}
        >
          <FileUploadHiddenInput />
          <FileUploadDropzone className="min-h-0 gap-1 px-3 py-2.5">
            <UploadCloudIcon className="size-4 text-muted-foreground" />
            <p className="text-center text-muted-foreground text-xs">
              Drop an <code className="font-mono">.orders</code> file
            </p>
            <FileUploadTrigger asChild>
              <Button className="text-xs" size="sm" variant="outline">
                Choose file
              </Button>
            </FileUploadTrigger>
          </FileUploadDropzone>
        </FileUpload>

        <div className="flex items-center gap-2">
          <code className="truncate font-mono text-[10px] text-muted-foreground">{fileName}</code>
          <Button
            className="ms-auto h-6 shrink-0 text-xs"
            onClick={() => setShowSource((open) => !open)}
            size="sm"
            variant="ghost"
          >
            {showSource ? "Hide source" : "Source"}
          </Button>
          <Show when={source !== DEFAULT_ORDERS}>
            <Button
              className="h-6 shrink-0 text-xs"
              onClick={() => {
                setSource(DEFAULT_ORDERS);
                setFileName("amber-hall.orders");
                unfocus();
              }}
              size="sm"
              variant="ghost"
            >
              Reset
            </Button>
          </Show>
        </div>

        <Show when={showSource}>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted p-2 font-mono text-[10px] leading-relaxed">
            {source}
          </pre>
        </Show>

        {errors.length > 0 ? (
          // A status border at 40% is a status turned down: 2.09:1 against the card in light and
          // 1.46:1 in dark, under the 3:1 a border that identifies an error owes — and in dark
          // fainter than the plain decorative `--border` (1.58:1). Solid: 4.57 / 4.07.
          <div className="space-y-1 rounded-md border border-destructive p-2">
            {errors.map((message) => (
              <p className="text-destructive text-xs" key={message}>
                {message}
              </p>
            ))}
          </div>
        ) : row === undefined ? (
          <Skeleton className="h-4 w-32" />
        ) : violations === 0 ? (
          <p className="text-success text-xs">In order — nothing in breach.</p>
        ) : (
          <p className="text-xs">
            <span className="text-destructive">{violations} violations</span>
            <Show when={warnings > 0}>
              <span className="text-muted-foreground"> · {warnings} warnings</span>
            </Show>
          </p>
        )}

        <ul className="space-y-1">
          {orders.map((order, i) => {
            const n = countOf(i);
            // `pending` is not `clean`. An absent row means the count is in flight — editing an
            // order re-runs the query — and `?? 0` would otherwise put a green tick on every one,
            // which is a report claiming order it has not measured.
            const clean = !pending && n === 0;
            return (
              <li className="flex items-stretch gap-1" key={order.id}>
                <Finding
                  disabled={pending || clean}
                  label={`${order.target} ${order.constraint}`}
                  load={() => failingIds(order)}
                  source="order"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        // The dot's siblings are `bg-success` and the severity fills, so it
                        // identifies state and owes 3:1. At 40% it landed on base step 7 —
                        // the border band — for 2.03:1 in light and 2.26:1 in dark. Solid
                        // `--muted-foreground` is step 11: 9.19 / 8.37.
                        pending && "bg-muted-foreground",
                        !pending && (clean ? "bg-success" : SEVERITY_DOT[order.severity]),
                      )}
                    />
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {order.target}
                    </code>
                    <span
                      className={cn(
                        "ms-auto text-xs tabular-nums",
                        pending && "text-muted-foreground",
                      )}
                    >
                      {pending ? "…" : clean ? "✓" : n}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px]">
                    {order.constraint}
                  </span>
                </Finding>
                <Show when={exact}>
                  <Button
                    aria-label={`Remove ${order.constraint}`}
                    className="h-auto shrink-0 self-stretch text-muted-foreground"
                    onClick={() => removeRule(order.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </Show>
              </li>
            );
          })}
        </ul>

        {/* The builder writes the document it just read, so it only opens when reading was
            lossless. Editing an inexact file would regenerate it without whatever the builder
            could not express — which is the failure this whole panel is arguing against. */}
        {exact ? (
          <OrderBuilder onAdd={addRule} rules={rules} />
        ) : (
          <div className="space-y-1 border-t pt-3">
            <p className="font-medium text-muted-foreground text-xs">
              Read-only — this file says more than the builder can write
            </p>
            {lost.map((message) => (
              <p className="font-mono text-[10px] text-muted-foreground" key={message}>
                {message}
              </p>
            ))}
          </div>
        )}

        <Show when={unsupported.length > 0}>
          <div className="space-y-1 border-t pt-2">
            <p className="font-medium text-muted-foreground text-xs">
              Not checked — outside the supported subset
            </p>
            {unsupported.map((message) => (
              <p className="font-mono text-[10px] text-warning" key={message}>
                {message}
              </p>
            ))}
          </div>
        </Show>

        {/* No "Focused" block here. The selection belongs to ONE place — `GraphSelection`, in the
            canvas corner — and it was appearing in every dock panel that could publish a clause,
            so clearing it read as a per-panel action when the thing being cleared is the page's
            single crossfilter. An order published from here shows up there, like any other. */}
      </div>
    </ScrollArea>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function Range({
  disabled,
  format,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  disabled?: boolean;
  format?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs">{label}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={(d) => onChange(d.value[0] ?? value)}
        step={step}
        value={[value]}
      />
    </div>
  );
}

const sameDisplay = (a: typeof DEFAULT_DISPLAY, b: typeof DEFAULT_DISPLAY) =>
  a.links === b.links &&
  a.labels === b.labels &&
  a.grid === b.grid &&
  a.pointScale === b.pointScale &&
  a.linkOpacity === b.linkOpacity;

const sameSim = (a: typeof DEFAULT_SIM, b: typeof DEFAULT_SIM) =>
  a.gravity === b.gravity &&
  a.repulsion === b.repulsion &&
  a.linkSpring === b.linkSpring &&
  a.linkDistance === b.linkDistance &&
  a.friction === b.friction &&
  a.cluster === b.cluster;

/**
 * What a gesture does, as a legend rather than a paragraph.
 *
 * The prose version was a run-on sentence with five `<kbd>`s buried in it. A reader scanning for
 * "how do I select two clusters" wants a table, and the library already ships the parts: `Kbd` for
 * a key, `KbdGroup` for a chord.
 */
const GESTURES: { keys: ReactNode; what: string }[] = [
  { keys: <Kbd>Drag</Kbd>, what: "Pan the canvas — or pin a node where you drop it, if you grab one" },
  { keys: <Kbd>Wheel</Kbd>, what: "Zoom where you point" },
  { keys: <Kbd>Click</Kbd>, what: "Focus a node together with its neighbours" },
  {
    keys: (
      <KbdGroup>
        <Kbd>Shift</Kbd>
        <Kbd>Drag</Kbd>
      </KbdGroup>
    ),
    what: "Marquee, without picking a tool first",
  },
  { keys: <Kbd>⌘ / Ctrl</Kbd>, what: "Add what you draw to the selection" },
  { keys: <Kbd>Alt</Kbd>, what: "Remove it from the selection instead" },
  { keys: <Kbd>Esc</Kbd>, what: "Back out — the drag, then the tool, then the selection" },
];

/**
 * The graph's APPEARANCE, and it lives in Preferences rather than in the dock.
 *
 * The split is not "graph things here, product things there" — it is the one
 * `decisions/a-section-brings-measurable-obligations.md` draws. A look and a display are an
 * appearance vocabulary whose obligations return a measured claim: `shape-capacity` puts the
 * ceiling at five shapes against seven colours, and `shape-floor` is a minimum radius a look
 * spending shape on identity may not go below. Gravity and friction are simulation coefficients and
 * no measurement grades them, so they stay in the dock beside the thing they re-heat.
 *
 * The comment this replaces put "a look, a node size and a friction coefficient" in one list. Two
 * of those three answer to a bar and the third does not.
 */
export function GraphAppearance() {
  const { display, look, setDisplay, setLook } = useGraphView();

  return (
    <div className="flex flex-col gap-4">
      <PreferencesFieldSet label="Look">
        {LOOK_ORDER.map((id) => (
          <button
            aria-pressed={look === id}
            className={cn(
              "w-full rounded-md border p-2 text-start transition-colors",
              // Same card-shaped toggle as `Finding`, so the same measured trio: the card,
              // `--secondary` on hover, `--accent` + a solid `border-primary` when chosen.
              look === id ? "border-primary bg-accent" : "hover:bg-secondary",
            )}
            key={id}
            onClick={() => setLook(id)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium text-xs">{LOOKS[id].label}</span>
              <span className="ms-auto flex items-center gap-1">
                {LEGEND_DOMAIN.map((kind, ordinal) => {
                  const preview = scaleOf(LOOKS[id]);
                  return (
                    <ShapeGlyph
                      className="size-2"
                      color={preview.color(ordinal)}
                      key={kind}
                      shape={preview.shape(ordinal)}
                    />
                  );
                })}
              </span>
            </span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground leading-relaxed">
              {LOOKS[id].blurb}
            </span>
          </button>
        ))}
      </PreferencesFieldSet>

      <PreferencesFieldSet label="Display">

        <div className="flex items-center justify-between">
          <span className="text-xs">Show links</span>
          <Switch
            checked={display.links}
            onCheckedChange={(d) => setDisplay({ links: d.checked === true })}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs">Labels</span>
          <Switch
            checked={display.labels}
            onCheckedChange={(d) => setDisplay({ labels: d.checked === true })}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs">Dot grid</span>
          <Switch
            checked={display.grid}
            onCheckedChange={(d) => setDisplay({ grid: d.checked === true })}
          />
        </div>

        <Range
          format={(v) => `${v.toFixed(1)}×`}
          label="Node size"
          max={2.5}
          min={0.4}
          onChange={(pointScale) => setDisplay({ pointScale })}
          step={0.1}
          value={display.pointScale}
        />

        <Range
          format={(v) => `${v.toFixed(1)}×`}
          label="Edge opacity"
          disabled={!display.links}
          max={3}
          min={0.1}
          onChange={(linkOpacity) => setDisplay({ linkOpacity })}
          step={0.1}
          value={display.linkOpacity}
        />

      </PreferencesFieldSet>

      <Button
        className="w-full"
        disabled={sameDisplay(display, DEFAULT_DISPLAY)}
        onClick={() => setDisplay(DEFAULT_DISPLAY)}
        size="sm"
        variant="ghost"
      >
        <RotateCcwIcon />
        Reset appearance
      </Button>
    </div>
  );
}

/**
 * The Settings panel — what is left once appearance moved out, and it is one thing.
 *
 * **Layout** changes the forces the GPU integrates, so nudging one re-heats the simulation and the
 * graph reorganises under you. That is why it is here and not in Preferences, and why its reset is
 * separate from the appearance one: they cost different things to press.
 */
export function GraphSettings() {
  const { commands, resetSim, setSim, sim, spec } = useGraphView();

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-4">
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-muted-foreground text-xs">Layout</p>
            <MotionBadge />
          </div>

          <Range
            label="Gravity"
            max={1}
            min={0}
            onChange={(gravity) => setSim({ gravity })}
            step={0.02}
            value={sim.gravity}
          />
          <Range
            label="Repulsion"
            max={2}
            min={0}
            onChange={(repulsion) => setSim({ repulsion })}
            step={0.05}
            value={sim.repulsion}
          />
          <Range
            label="Link spring"
            max={2}
            min={0}
            onChange={(linkSpring) => setSim({ linkSpring })}
            step={0.05}
            value={sim.linkSpring}
          />
          <Range
            format={(v) => v.toFixed(0)}
            label="Link distance"
            max={40}
            min={1}
            onChange={(linkDistance) => setSim({ linkDistance })}
            step={1}
            value={sim.linkDistance}
          />
          <Range
            label="Friction"
            max={1}
            min={0.5}
            onChange={(friction) => setSim({ friction })}
            step={0.01}
            value={sim.friction}
          />
          {/* The control is named by the spec, not by this corpus. A canvas told which column
              groups its nodes can say so; one that hardcodes "Hall" only ever had one archive. */}
          <Show when={spec.groupField !== undefined}>
            <Range
              label="Clustering"
              max={1}
              min={0}
              onChange={(cluster) => setSim({ cluster })}
              step={0.02}
              value={sim.cluster}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pulls each node toward its{" "}
              <code className="font-mono">{spec.groupLabel ?? spec.groupField}</code>. A node with no
              value there belongs to no cluster, so anything shared drifts between the groups it
              joins.
            </p>
          </Show>

        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="font-medium text-muted-foreground text-xs">Camera</p>
          <Button className="w-full" onClick={() => commands.fit()} size="sm" variant="outline">
            <MaximizeIcon />
            Fit to view
          </Button>
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="font-medium text-muted-foreground text-xs">Gestures</p>
          <dl className="space-y-1.5">
            {GESTURES.map((gesture) => (
              <div className="flex items-baseline gap-2" key={gesture.what}>
                <dt className="shrink-0">{gesture.keys}</dt>
                <dd className="text-[11px] text-muted-foreground leading-snug">{gesture.what}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Layout only. It used to restore Display too, and that was right while both lived in
            this panel — a reset here that silently reached into Preferences would not be. The
            appearance half has its own, beside the controls it restores. */}
        <div className="border-t pt-3">
          <Button
            className="w-full"
            disabled={sameSim(sim, DEFAULT_SIM)}
            onClick={resetSim}
            size="sm"
            variant="ghost"
          >
            <RotateCcwIcon />
            Reset layout
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Ask ──────────────────────────────────────────────────────────────────────

/**
 * The Ask panel — the library's AI surface over a faked stream, and answers that are queried.
 *
 * The split is deliberate and it is the only honest way to show this without a model: the
 * **language** is canned, the **answer** is not. A question is matched to an intent, and the intent
 * carries a SQL predicate — so the number in the reply is a `count(*)` against the corpus, and
 * "Focus" publishes the matching ids into the crossfilter and the canvas lights them up. Nothing
 * here pretends to have understood anything it did not.
 *
 * What it does demonstrate for real is the library's AI compounds: `SuggestRoot` streaming candidate
 * questions with their rationale, and `CompleteRoot` ghosting a continuation that Tab accepts. Both
 * take an async generator, which is exactly what a real model gives you — swapping the fake for a
 * stream from the API means changing these two functions and nothing else.
 */
interface Intent {
  id: string;
  /** Words that select this intent. */
  match: string[];
  question: string;
  /** How the answer is phrased before the count is filled in. */
  answer: (n: number) => string;
  failing: string;
}

/** Five years back from the world's own today, which is 14 September 1312 and never the clock. */
const FIVE_YEARS_BACK = isoDay(-5 * 365);

const INTENTS: Intent[] = [
  {
    id: "old",
    match: ["old", "oldest", "long ago", "years", "before", "closed before"],
    question: "What has been in the archive more than five years?",
    answer: (n) => `${n} contracts were closed before ${FIVE_YEARS_BACK}.`,
    failing: `kind = 'contract' AND closed < DATE '${FIVE_YEARS_BACK}'`,
  },
  {
    id: "orphan",
    match: ["orphan", "unused", "tag", "lonely", "only one contract"],
    question: "Are there tags only one contract carries?",
    answer: (n) => `${n} tags were used once and never again — a vocabulary of one.`,
    failing: "kind = 'tag' AND degree < 2",
  },
  {
    id: "filed",
    match: ["report", "filed", "who wrote", "cantor", "sapper", "alchemist"],
    question: "Which reports were filed by someone the orders do not send?",
    answer: (n) => `${n} field reports were filed by a role other than a warden, archivist or scout.`,
    failing: "kind = 'report' AND label NOT IN ('warden', 'archivist', 'scout')",
  },
  {
    id: "hubs",
    match: ["hub", "connected", "busiest", "central", "biggest", "most work"],
    question: "What holds the archive together?",
    answer: (n) => `${n} nodes touch 60 others or more — the members, regions and tags everything hangs off.`,
    failing: "degree >= 60",
  },
  {
    id: "hall",
    match: ["amber", "hall", "tenant", "whose"],
    question: "How much of this is the Amber Hall's?",
    answer: (n) => `${n} nodes sit on the Amber Hall's arc — its contracts and their field reports.`,
    failing: "hall = 'amber'",
  },
];

/** Candidate questions, streamed the way a model would hand them over. */
async function* askSuggestions(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const intent of INTENTS) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (signal?.aborted) return;
    yield { value: intent.question, rationale: `Answered by one count over the node relation.` };
  }
}

/** The ghost continuation. Canned, and only ever offered for a prefix it recognises. */
async function* completeQuestion(value: string, signal?: AbortSignal) {
  const typed = value.trim().toLowerCase();
  if (typed.length < 3) return;
  const hit = INTENTS.find((intent) => intent.question.toLowerCase().startsWith(typed));
  if (!hit) return;
  for (const chunk of hit.question.slice(value.length).split(/(?<=\s)/)) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (signal?.aborted) return;
    yield chunk;
  }
}

/**
 * The intent's own question wins before any keyword does — a suggestion the panel just offered must
 * always resolve to the intent that produced it, and none of them contains its own keywords.
 */
function match(question: string): Intent | null {
  const asked = question.trim().toLowerCase();
  const offered = INTENTS.find((intent) => intent.question.toLowerCase() === asked);
  if (offered) return offered;
  return INTENTS.find((intent) => intent.match.some((word) => asked.includes(word))) ?? null;
}

export function GraphAsk() {
  const { ready } = useGraphView();
  if (!ready) {
    return (
      <div className="p-3">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return <AskBody />;
}

interface Answer {
  intent: Intent;
  count: number;
}

function AskBody() {
  const { coordinator } = useMosaic();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (asked: string) => {
    const intent = match(asked);
    setAnswer(null);
    setMissed(intent === null);
    if (!intent) return;
    setBusy(true);
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ n: count() }).where(intent.failing),
    );
    const rows = Array.from(data as Iterable<Record<string, unknown>>);
    setAnswer({ intent, count: Number(rows[0]?.n ?? 0) });
    setBusy(false);
  };

  const matchingIds = async (intent: Intent) => {
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ id: "id" }).where(intent.failing),
    );
    return numbers(data, "id");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1 p-3">
        <div className="space-y-3">
          <Show when={answer === null && !missed}>
            <p className="text-muted-foreground text-xs">
              Ask about the graph. Every answer is a query — the phrasing is canned, the numbers are
              not.
            </p>
          </Show>

          <Show when={missed}>
            <p className="text-warning text-xs">
              That one is outside what this fake stream knows. Try the ✨ suggestions.
            </p>
          </Show>

          <Show when={busy}>
            <Skeleton className="h-10 w-full" />
          </Show>

          {/* The answer IS the control, the same way a rule is. A count you can act on should not
              need a second widget to say so. */}
          {answer ? (
            <Finding
              disabled={answer.count === 0}
              label={answer.intent.question}
              load={() => matchingIds(answer.intent)}
              source="ask"
            >
              <span className="flex items-baseline gap-2">
                <span className="flex-1 text-xs leading-relaxed">
                  {answer.intent.answer(answer.count)}
                </span>
                <span className="shrink-0 font-medium text-xs tabular-nums">{answer.count}</span>
              </span>
              <code className="mt-1.5 block truncate font-mono text-[10px] text-muted-foreground">
                {answer.intent.failing}
              </code>
            </Finding>
          ) : null}

        </div>
      </ScrollArea>

      {/* The composer, in the library's `InputGroup` idiom: the field is the box, and Suggest and
          Ask live INSIDE it on the block-end edge. That is what fixes the ✨ popover — it used to
          hang off a label row above the field and open against the dock's edge, far from the text
          it writes; anchored to its own trigger inside the group it opens over the composer.

          Textarea, not Input: a question is prose, and the library pairs `CompleteTextarea` with
          `CompleteHint` (the continuation streams *below* the field) while reserving
          `CompleteInput` + `CompleteGhost` for single-line values. The cost is Enter: it belongs to
          the newline now, so submitting is ⌘/Ctrl+Enter or the button. */}
      <div className="shrink-0 border-t border-border p-2">
        <CompleteRoot complete={completeQuestion} onValueChange={setQuestion} value={question}>
          <InputGroup>
            <CompleteTextarea>
              <InputGroupTextarea
                className="min-h-16 resize-none text-sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submit(question);
                  }
                }}
                placeholder="Ask about your data…"
              />
            </CompleteTextarea>
            <InputGroupAddon align="block-end">
              <SuggestRoot
                existing={[]}
                onPick={(value) => {
                  setQuestion(value);
                  void submit(value);
                }}
                suggest={askSuggestions}
              >
                <SuggestTrigger label="Suggest a question" />
                <SuggestContent />
              </SuggestRoot>
              <InputGroupButton
                className="ms-auto"
                disabled={question.trim().length === 0 || busy}
                onClick={() => void submit(question)}
              >
                <SendIcon />
                Ask
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <CompleteHint />
        </CompleteRoot>
      </div>
    </div>
  );
}
