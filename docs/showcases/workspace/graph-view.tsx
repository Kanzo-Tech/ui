"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clausePoints } from "@uwdata/mosaic-core";
import { desc, sql } from "@uwdata/mosaic-sql";
import {
  Badge,
  Button,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  NumberField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  createListCollection,
  Kbd,
  KbdGroup,
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
  DateField,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  TextField,
  useFilter,
  useListCollection,
  type Suggestion,
} from "@kanzo-tech/ui";
import {
  Query,
  chartSeriesColor,
  count,
  useChartCapacity,
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
  compileShacl,
  DEFAULT_SHAPES,
  pathDatatype,
  type Severity,
  type Shape,
  SUPPORTED_PATHS,
  SUPPORTED_TARGETS,
} from "./shacl";
import {
  CONSTRAINT_KINDS,
  type ConstraintKind,
  isValidValue,
  members,
  parseRules,
  type Rule,
  toTurtle,
} from "./rule-builder";
import { numbers } from "@/lib/arrow";
import {
  DEFAULT_DISPLAY,
  DEFAULT_SIM,
  EDGES,
  KINDS,
  NODES,
  useGraphView,
  type Motion,
} from "./graph-state";
import {
  LOOKS,
  LOOK_ORDER,
  onceQuery,
  scaleOf,
} from "@kanzo-tech/graph";
import type { NodeKind } from "./graph-data";
import { ShapeGlyph } from "./graph-canvas";
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

// ── Legend and counts ────────────────────────────────────────────────────────

/** The legend draws the glyph the canvas draws, so a look that encodes kind as shape stays legible. */
/**
 * The domain the swatches are drawn against.
 *
 * `KINDS` is the fixture's declared order, and the canvas colours by the order the *data* turned
 * out to have. They agree here because the corpus contains all four; they are not guaranteed to,
 * and that gap is the cross-panel binding problem — Vega-Lite's `resolve: {scale: {color: shared}}`
 * — which nothing in this showcase declares yet. Keeping the domain in one named place is what
 * makes it a one-line fix when it does.
 */
const LEGEND_DOMAIN = Object.keys(KINDS);

function LegendSwatch({ kind }: { kind: string }) {
  const { look } = useGraphView();
  const capacity = useChartCapacity();
  const scale = scaleOf(LOOKS[look], LEGEND_DOMAIN, capacity);
  return (
    <ShapeGlyph
      color={scale.color(kind)}
      shape={scale.shape(kind)}
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
  theme: string;
  publisher: string;
  degree: number;
  issued: string;
  keywords: string;
}

const COLUMNS = {
  id: "id",
  label: "label",
  kind: "kind",
  theme: "theme",
  publisher: "publisher",
  degree: "degree",
  issued: "issued",
  keywords: "keywords",
};

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: `issued` is a CSV column DuckDB
 * infers as DATE, so Arrow returns a `Date` object, and rendering one crashes React with "Objects
 * are not valid as a React child". Anything coming out of a query is formatted before it is shown.
 */
function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

/** The predicates a node carries, in the RDF idiom the panel already spoke. */
function properties(node: NodeRow): { predicate: string; value: string }[] {
  const rows = [{ predicate: "rdf:type", value: `dcat:${node.kind}` }];
  if (node.publisher) rows.push({ predicate: "dct:publisher", value: text(node.publisher) });
  if (node.theme) rows.push({ predicate: "dcat:theme", value: text(node.theme) });
  if (node.issued) rows.push({ predicate: "dct:issued", value: text(node.issued) });
  if (node.keywords) {
    rows.push({ predicate: "dcat:keyword", value: text(node.keywords).split("|").join(", ") });
  }
  rows.push({ predicate: "kanzo:degree", value: text(node.degree) });
  return rows;
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
      focused === null ? null : Query.from(NODES).select(COLUMNS).where(`id = ${focused}`),
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
        <p className="mt-0.5 break-all text-muted-foreground text-xs">
          urn:{head.kind}:{head.label}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge className="text-[10px]" size="xs" variant="outline">
            {KINDS[head.kind]?.label ?? head.kind}
          </Badge>
          {/* "Reveal" said nothing about what it reveals or where. It moves the CAMERA: the node
              is already on screen somewhere, and this brings it into view. */}
          <Button
            className="h-5 gap-1 text-[10px]"
            onClick={() => commands.reveal(head.id)}
            size="xs"
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
                  className="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-start text-xs hover:bg-accent"
                  onClick={() => commands.reveal(node.id)}
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
 * Find one entity and select it.
 *
 * Not `ChartSearch`, and the difference is what the control MEANS. `ChartSearch` publishes a
 * `clauseMatch` — a substring filter over a column — and offers completions through a native
 * `<datalist>`. That is the right instrument for "narrow this to everything containing eu-", and
 * the wrong one for "take me to this node": a datalist cannot be styled, differs in every browser,
 * has no empty state, shows no context beside a value, and silently stops at its limit.
 *
 * Picking is a value, so this is a `Combobox`, and what it publishes is that node's id — the
 * canvas lights it up, the panel below describes it, and the footer retallies. The list is capped
 * and SAYS it is capped, which is the part the datalist could not do.
 */
const SEARCH_LIMIT = 50;

function EntitySearch() {
  const { crossfilter } = useMosaic();
  const source = useRef({ shape: "entity-search" });

  // The whole corpus, once, against no filter: a search that only finds what is already on screen
  // cannot take you anywhere. 582 rows is small enough to filter in the browser; a real corpus
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
      <ComboboxInput placeholder="Find an entity…" size="sm" />
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
          <EntitySearch />
        ) : (
          <TextField
            disabled
            iconStart={<SearchIcon className="size-3.5" />}
            placeholder="Search entities…"
            size="sm"
          />
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        {ready ? <InspectorBody /> : <Skeleton className="h-24 w-full" />}
      </ScrollArea>
    </div>
  );
}

// ── Rules ────────────────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<Severity, string> = {
  violation: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

/** What a value looks like for each constraint — the placeholder does the explaining. */
const VALUE_HINT: Record<ConstraintKind, string> = {
  minCount: "1",
  maxCount: "5",
  minInclusive: "2020-01-01",
  maxInclusive: "100",
  in: "parquet, csv",
  pattern: "^eu-",
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
const KINDS_LIST = of(CONSTRAINT_KINDS, (v) => `sh:${v}`);
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
  /** The terms are identifiers; the severity is a plain English word. */
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
        {/* Mono for the term, sans for the connective: a CURIE is an identifier and the rules list
            below already sets it that way, so a sans-serif `dct:issued` in the form and a mono one
            in the list read as two different things. */}
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
 * The rule builder — menus in, Turtle out.
 *
 * It has no model of its own: it appends a `sh:property` to the document the panel already
 * compiles, so a rule you pick from these menus and a rule you uploaded are the same thing by the
 * time anything downstream sees either. The menus offer only what `./shacl` can map, which is why
 * a built rule always compiles.
 */
function RuleBuilder({
  rules,
  onAdd,
}: {
  rules: Rule[];
  onAdd: (rule: Omit<Rule, "id">) => void;
}) {
  const [target, setTarget] = useState(SUPPORTED_TARGETS[0] ?? "dcat:Dataset");
  const [path, setPath] = useState(SUPPORTED_PATHS[0] ?? "dct:issued");
  const [kind, setKind] = useState<ConstraintKind>("minCount");
  const [value, setValue] = useState("1");
  const [severity, setSeverity] = useState<Severity>("violation");

  // One constraint of a kind per path, because that is all the document can say apart: a second
  // `sh:minCount` on the same path would compile to a shape with the same identity as the first.
  const duplicate = rules.some(
    (rule) => rule.target === target && rule.path === path && rule.kind === kind,
  );
  // Two different reasons Add can be off, and the field only owns one of them: marking the value
  // invalid because the PATH already has this constraint would blame the wrong control.
  const valueOk = isValidValue(kind, value);
  const valid = valueOk && !duplicate;
  /** A bound on a date column is a date — the only place the control needs the path's datatype. */
  const isDateBound =
    pathDatatype(path) === "date" && (kind === "minInclusive" || kind === "maxInclusive");

  return (
    <div className="space-y-1.5 border-t pt-3">
      <p className="font-medium text-muted-foreground text-xs">Add a rule</p>
      {/* Read as the sentence a shape actually is — every X must have Y, so-and-so — rather than
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
          {/* The control follows the constraint AND the path, because between them they decide
              what a value IS. `sh:in` is a set, so it gets tags rather than a line of text with
              commas in it; a bound on a date column is a date; a cardinality is a number with
              steppers. Typing "2020-13-01" into a text box and finding out from DuckDB is the
              version of this the panel used to have. */}
          <div className="min-w-0 flex-1">
            {kind === "in" ? (
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
              <DateField
                aria-label="Value"
                invalid={!valueOk}
                onChange={(next) => setValue(next ?? "")}
                value={value}
              />
            ) : kind === "minCount" || kind === "maxCount" ? (
              <NumberField
                aria-label="Value"
                className="h-8 w-full font-mono text-xs"
                invalid={!valueOk}
                min={0}
                onChange={(e) => setValue(e.target.value)}
                placeholder={VALUE_HINT[kind]}
                value={value}
              />
            ) : (
              <TextField
                aria-label="Value"
                className="h-8 w-full font-mono text-xs"
                invalid={!valueOk}
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
            {target} already carries an sh:{kind} on {path}.
          </p>
        </Show>
      </div>
    </div>
  );
}

/**
 * The Rules panel — a SHACL shapes file, compiled to SQL, with the graph as the report.
 *
 * The shapes are not a constant in this file: they are a Turtle document, parsed with a real Turtle
 * parser and compiled by `./shacl`, and you can drop your own over it. That is what makes the panel
 * a validator rather than a picture of one — the same file could go to any other SHACL engine.
 *
 * A conformance report is a list of counts, which is a list of `count(*) FILTER (WHERE …)`, which is
 * one query. And focusing a shape queries the ids that fail it and publishes them into the
 * crossfilter, so the canvas lights up exactly the offending nodes, the legend retallies by kind and
 * the inspector ranks them — the panel does not draw anything or know those exist.
 *
 * The counts are read against the whole corpus (`filterBy: null`), not the current view: a report
 * that changed as you browsed would be a different question every time you looked.
 */
export function GraphRules() {
  const { ready } = useGraphView();
  if (!ready) {
    return (
      <div className="p-3">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <RulesBody />;
}

function RulesBody() {
  const { select } = useGraphView();
  const { coordinator } = useMosaic();
  const [turtle, setTurtle] = useState(DEFAULT_SHAPES);
  const [fileName, setFileName] = useState("kanzo-shapes.ttl");
  const [showSource, setShowSource] = useState(false);

  const { shapes, unsupported, errors } = useMemo(() => compileShacl(turtle), [turtle]);

  // The same document, read as rules the builder can write back. `exact` is what makes editing
  // safe: regenerating the file drops whatever the builder could not read, so when anything would
  // be lost the panel stays read-only and says what it is protecting.
  const { rules, exact, lost } = useMemo(() => parseRules(turtle), [turtle]);

  /** A shape that no longer exists must not keep lighting up nodes. */
  const unfocus = () => select(null);

  const addRule = (rule: Omit<Rule, "id">) => {
    unfocus();
    setTurtle(toTurtle([...rules, rule]));
  };

  const removeRule = (id: string) => {
    unfocus();
    setTurtle(toTurtle(rules.filter((rule) => rule.id !== id)));
  };

  // Every shape's failing count, in one pass over the relation.
  const { row } = useChartQuery({
    filterBy: null,
    deps: [shapes.map((s) => s.id).join("|")],
    query: () =>
      shapes.length === 0
        ? null
        : // `sql` nests the compiler's predicate as a node rather than pasting its text: the
          // aggregate is the only SQL written here, and `s.failing` arrives already built.
          Query.from(NODES).select(
            Object.fromEntries(
              shapes.map((s, i) => [`c${i}`, sql`count(*) FILTER (WHERE ${s.failing})`]),
            ),
          ),
  });

  const countOf = (i: number) => Number(row?.[`c${i}`] ?? 0);
  /** No row yet: the counts are being queried, not zero. */
  const pending = row === undefined;
  const total = (severity: Severity) =>
    shapes.reduce((n, s, i) => (s.severity === severity ? n + countOf(i) : n), 0);
  const violations = total("violation");
  const warnings = total("warning");

  const failingIds = async (shape: Shape) => {
    const data = await onceQuery(coordinator, () =>
      Query.from(NODES).select({ id: "id" }).where(shape.failing),
    );
    return numbers(data, "id");
  };

  const load = async (file: File) => {
    unfocus();
    setFileName(file.name);
    setTurtle(await file.text());
  };

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-3">
        <FileUpload
          accept=".ttl,text/turtle"
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
              Drop a <code className="font-mono">.ttl</code> shapes file
            </p>
            <FileUploadTrigger asChild>
              <Button className="h-6 text-xs" size="xs" variant="outline">
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
            size="xs"
            variant="ghost"
          >
            {showSource ? "Hide source" : "Source"}
          </Button>
          <Show when={turtle !== DEFAULT_SHAPES}>
            <Button
              className="h-6 shrink-0 text-xs"
              onClick={() => {
                setTurtle(DEFAULT_SHAPES);
                setFileName("kanzo-shapes.ttl");
                unfocus();
              }}
              size="xs"
              variant="ghost"
            >
              Reset
            </Button>
          </Show>
        </div>

        <Show when={showSource}>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted p-2 font-mono text-[10px] leading-relaxed">
            {turtle}
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
          <p className="text-success text-xs">Conforms — no violations.</p>
        ) : (
          <p className="text-xs">
            <span className="text-destructive">{violations} violations</span>
            <Show when={warnings > 0}>
              <span className="text-muted-foreground"> · {warnings} warnings</span>
            </Show>
          </p>
        )}

        <ul className="space-y-1">
          {shapes.map((shape, i) => {
            const n = countOf(i);
            // `pending` is not `clean`. An absent row means the count is in flight — editing a rule
            // re-runs the query — and `?? 0` would otherwise put a green tick on every shape,
            // which is a report claiming conformance it has not measured.
            const clean = !pending && n === 0;
            return (
              <li className="flex items-stretch gap-1" key={shape.id}>
                <Finding
                  disabled={pending || clean}
                  label={`${shape.target} ${shape.constraint}`}
                  load={() => failingIds(shape)}
                  source="rule"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        // The dot's siblings are `bg-success` and the severity fills, so it
                        // identifies state and owes 3:1. At 40% it landed on neutral step 7 —
                        // the border band — for 2.03:1 in light and 2.26:1 in dark. Solid
                        // `--muted-foreground` is step 11: 9.19 / 8.37.
                        pending && "bg-muted-foreground",
                        !pending && (clean ? "bg-success" : SEVERITY_DOT[shape.severity]),
                      )}
                    />
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {shape.target}
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
                    {shape.constraint}
                  </span>
                </Finding>
                <Show when={exact}>
                  <Button
                    aria-label={`Remove ${shape.constraint}`}
                    className="h-auto shrink-0 self-stretch text-muted-foreground"
                    onClick={() => removeRule(shape.id)}
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
          <RuleBuilder onAdd={addRule} rules={rules} />
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
            single crossfilter. A shape published from here shows up there, like any other. */}
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
 * The Settings panel, in two halves that never meet.
 *
 * **Look** and **Display** change how the picture is drawn — a buffer upload and a `setConfig`, no
 * query and no restart. **Layout** changes the forces the GPU integrates, so nudging one re-heats
 * the simulation and the graph reorganises under you. That separation is what the previous canvas
 * could not offer: with the layout frozen into two columns, simulation sliders were furniture.
 */
export function GraphSettings() {
  const { commands, display, look, resetSim, setDisplay, setLook, setSim, sim, spec } =
    useGraphView();

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-xs">Look</p>
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
                  {LEGEND_DOMAIN.map((kind) => {
                    const preview = scaleOf(LOOKS[id], LEGEND_DOMAIN);
                    return (
                      <ShapeGlyph
                        className="size-2"
                        color={preview.color(kind)}
                        key={kind}
                        shape={preview.shape(kind)}
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
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="font-medium text-muted-foreground text-xs">Display</p>

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

        </div>

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
              groups its nodes can say so; one that hardcodes "Theme" only ever had one dataset. */}
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

        {/* One reset, and its own block: it restores Display and Layout, so hanging it off Camera
            would have promised something it does not do. */}
        <div className="border-t pt-3">
          <Button
            className="w-full"
            disabled={sameDisplay(display, DEFAULT_DISPLAY) && sameSim(sim, DEFAULT_SIM)}
            onClick={() => {
              setDisplay(DEFAULT_DISPLAY);
              resetSim();
            }}
            size="sm"
            variant="ghost"
          >
            <RotateCcwIcon />
            Reset display and layout
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

const INTENTS: Intent[] = [
  {
    id: "stale",
    match: ["stale", "old", "2019", "issued", "outdated", "published before"],
    question: "Which datasets were published before 2020?",
    answer: (n) => `${n} datasets declare a dct:issued before 2020-01-01.`,
    failing: "kind = 'dataset' AND issued < DATE '2020-01-01'",
  },
  {
    id: "orphan",
    match: ["orphan", "unused", "keyword", "lonely", "only one dataset"],
    question: "Are there keywords only one dataset uses?",
    answer: (n) => `${n} keywords are attached to a single dataset — weak vocabulary.`,
    failing: "kind = 'keyword' AND degree < 2",
  },
  {
    id: "format",
    match: ["format", "parquet", "csv", "distribution", "netcdf", "preferred"],
    question: "Which distributions are not in a preferred format?",
    answer: (n) => `${n} distributions sit outside parquet / csv / graphar.`,
    failing: "kind = 'distribution' AND label NOT IN ('parquet', 'csv', 'graphar')",
  },
  {
    id: "hubs",
    match: ["hub", "connected", "degree", "central", "biggest"],
    question: "What are the most connected nodes?",
    answer: (n) => `${n} nodes have a degree of 20 or more — the hubs holding the graph together.`,
    failing: "degree >= 20",
  },
  {
    id: "environment",
    match: ["climate", "weather", "environment", "envi"],
    question: "What is in the environment theme?",
    answer: (n) => `${n} nodes carry dcat:theme ENVI.`,
    failing: "theme = 'ENVI'",
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
