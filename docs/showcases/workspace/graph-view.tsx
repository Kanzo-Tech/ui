"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { parseDate, type DateValue } from "@internationalized/date";
import { sql, verbatim, type VerbatimNode } from "@uwdata/mosaic-sql";
import {
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
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  Input,
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
  Skeleton,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  toast,
} from "@kanzo-tech/ui";
import { Chat, ChatSkeleton, useChat } from "@kanzo-tech/ai";
import {
  dataAgent,
  dataSuggestions,
  describeSchema,
  QueryResult,
  type DataSchema,
  type DataScope,
  type QueryOutput,
} from "@kanzo-tech/ai/data";
import { DirectChatTransport } from "@kanzo-tech/llm";
import { afterTool, askOf, mockModel, promptOf } from "@/lib/mock-model";
import {
  Coordinator,
  MosaicProvider,
  Query,
  Selection as MosaicSelection,
  clauseSemiJoin,
  numbers,
  useChartQuery,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import {
  SparklesIcon,
  PlusIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@kanzo-tech/ui";
import {
  GraphCounts,
  GraphInspector,
  GraphLooks,
  GraphPlacement,
  GraphRoot,
  GraphSearch,
  GraphSelect,
  GraphStatus,
  corpusReferences,
  useGraphContext,
  useGraphPrefs,
  type Channels,
  type LookPreset,
  type VertexDetail,
} from "@kanzo-tech/graph";
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
import { open } from "@fossil-lang/corpus";
import { ARCHIVE_KINDS as KINDS } from "@/example/archive";
import { HALLS, isoDay } from "@/example/world";
import { ensure } from "./duck";

/**
 * The archive's graph, and the product panels around it.
 *
 * **The graph is one `GraphRoot` composition** — `ArchiveGraph` below, and the parts `default.tsx`
 * places. Everything else in this file is the product's: the named pairings of look and channels,
 * the hall's name in the inspector, the archive search, the standing orders, the ask box and the
 * two preferences panels. Every number a panel shows is a query against the node relation, and
 * every selection a panel makes goes through the root's `select` — so none of them reads the
 * canvas, or needs to know a graph is what the selection is drawn on.
 */

/**
 * Where the compiled archive is served from, written by `corpus/build-corpus.mjs`. Prefixed, because
 * a string handed to DuckDB is not rewritten under `basePath` the way `Link` is: under `/ui` a bare
 * `/corpus/…` is a 404 with no error anywhere. `NEXT_PUBLIC_BASE_PATH` is the variable
 * `next.config.ts` reads, so the two cannot disagree.
 */
const CORPUS = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

/** The archive's one vertex type, which the orders and the ask box query. */
const TYPE = "Node";

/** The address column a panel's `SELECT` names, so a picked row becomes a vertex. */
const ID = "dense_id";

/** The catalog the archive is attached under — every relation below is spelled with it. */
const FROM = "archive";

/**
 * An attached archive: the coordinator and crossfilter every panel and the canvas query through, and
 * the node relation as the orders and the ask box name it — a node rather than a string, because
 * `Query.from("x")` quotes a string again and `"catalog"."Node"` is no table.
 */
export interface Archive {
  coordinator: Coordinator;
  crossfilter: MosaicSelection;
  nodes: VerbatimNode;
}

function openArchive(): Promise<Archive> {
  return ensure(CORPUS, async (engine) => {
    // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem. The page
    // holds the catalog for its life, so the `close` that `open` answers is not kept.
    await open(FROM, { engine, url: `${window.location.origin}${CORPUS}` });
    return {
      coordinator: engine.coordinator,
      crossfilter: MosaicSelection.crossfilter(),
      nodes: verbatim(`"${FROM}"."${TYPE}"`),
    };
  });
}

/** The archive once it is attached, or `null` while it attaches or when it would not — said once, as a toast. */
export function useArchive(): Archive | null {
  const [archive, setArchive] = useState<Archive | null>(null);
  useEffect(() => {
    let live = true;
    openArchive().then(
      (opened) => live && setArchive(opened),
      (error) => live && announce(error),
    );
    return () => {
      live = false;
    };
  }, []);
  return archive;
}

/**
 * The channels each look is paired with — the product's half of a look, since a look is form and a
 * binding is the caller's. Ink paints every point one ink — `fill` as a constant — and spends
 * identity on shape; a customised picture keeps Atlas's bindings.
 */
const PAIRINGS: Record<LookPreset, Channels> = {
  nebula: { fill: "kind" },
  atlas: { fill: "kind", stroke: "var(--muted-foreground)" },
  ink: { fill: "var(--foreground)", symbol: "kind", stroke: "var(--muted-foreground)" },
};

/**
 * A failure, as a toast — once per message, and after the commit that reported it: the renderer
 * reports from an effect, where a toast's synchronous flush is refused.
 */
function announce(error: unknown): void {
  const title = error instanceof Error ? error.message : String(error);
  queueMicrotask(() => {
    if (!toast.isVisible(title)) toast.create({ id: title, title, type: "error" });
  });
}

type Placement = Pick<Channels, "x" | "y" | "cluster">;

/**
 * Where the points come from, as the reader chose it in Settings — the page's state, handed to the
 * root as it is, and shared with the Settings panel that sits under the same root.
 */
const PlacementContext = createContext<[Placement, Dispatch<SetStateAction<Placement>>] | null>(null);

function usePlacement() {
  const placement = use(PlacementContext);
  if (!placement) throw new Error("usePlacement must be used within ArchiveGraph");
  return placement;
}

/**
 * **The graph, whole.** The root names the attached catalog and reads it through the page's
 * coordinator, one Mosaic client beside the charts; the provider arrives with the same coordinator,
 * and the panels under it query the node relation the orders and the ask box are written against.
 */
export function ArchiveGraph({ children }: { children: ReactNode }) {
  const archive = useArchive();
  const { look, sim, preset } = useGraphPrefs();
  const placement = useState<Placement>({});
  return (
    <PlacementContext value={placement}>
      <GraphRoot
        categories={KINDS}
        coordinator={archive?.coordinator ?? null}
        filterBy={archive?.crossfilter}
        from={archive ? FROM : null}
        look={look}
        onFailure={announce}
        r="degree"
        sim={sim}
        title="label"
        {...PAIRINGS[preset ?? "atlas"]}
        {...placement[0]}
      >
        <Show fallback={children} when={archive !== null}>
          {archive && (
            <MosaicProvider coordinator={archive.coordinator} crossfilter={archive.crossfilter}>
              {children}
            </MosaicProvider>
          )}
        </Show>
      </GraphRoot>
    </PlacementContext>
  );
}

/** The footer: where the graph is, and how much of the corpus there is. */
export function ArchiveFooter() {
  return (
    <span className="flex items-center gap-2 px-1">
      <GraphStatus />
      <GraphCounts />
    </span>
  );
}

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
      <DatePickerInput
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
      />
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

// ── Info ─────────────────────────────────────────────────────────────────────

/**
 * The hall a vertex belongs to, by the name a reader knows it by — the one field this product adds
 * to the inspector, because the relation stores the id. Everything the halls share belongs to none.
 */
function HallName({ detail }: { detail: VertexDetail }) {
  const id = detail.fields.find((field) => field.name === "hall")?.value;
  const name = HALLS.find((entry) => entry.id === id)?.short;
  return (
    <DataListItem className="gap-0.5 py-0">
      <DataListItemLabel className="text-xs">hall name</DataListItemLabel>
      <DataListItemValue>{name ?? "shared across the halls"}</DataListItemValue>
    </DataListItem>
  );
}

/** The Info panel: the package's search and inspector, with the hall's name added. */
export function GraphInfo() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-2">
        <GraphSearch placeholder="Find anything in the archive…" />
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        <GraphInspector>{(detail) => <HallName detail={detail} />}</GraphInspector>
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
const of = (
  values: readonly string[],
  label: (v: string) => string = (v) => v
) =>
  createListCollection({
    items: values.map((value) => ({ label: label(value), value })),
  });

const TARGETS_LIST = of(SUPPORTED_TARGETS);
const PATHS_LIST = of(SUPPORTED_PATHS);
const KINDS_LIST = of(CONSTRAINT_KINDS);
const SEVERITY_LIST = of(
  Object.keys(SEVERITY_LABEL) as Severity[],
  (v) => SEVERITY_LABEL[v as Severity]
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
      <span className="w-16 shrink-0 text-end text-muted-foreground text-xs">
        {label}
      </span>
      <Select
        className="min-w-0 flex-1"
        collection={collection}
        onValueChange={(details) =>
          details.value[0] && onChange(details.value[0])
        }
        positioning={{ sameWidth: true }}
        value={[value]}
      >
        {/* Mono for the term, sans for the connective: a property is a word out of the document and
            the list below already sets it that way, so a sans-serif `closed` in the form and a mono
            one in the list read as two different things. */}
        <SelectTrigger
          aria-label={label}
          className={cn("h-8 w-full text-xs", mono && "font-mono")}
        >
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
    (rule) => rule.target === target && rule.path === path && rule.kind === kind
  );
  // Two different reasons Add can be off, and the field only owns one of them: marking the value
  // invalid because the PROPERTY already has this constraint would blame the wrong control.
  const valueOk = isValidValue(kind, value);
  const valid = valueOk && !duplicate;
  /** A bound on a date column is a date — the only place the control needs the property's datatype. */
  const isDateBound =
    pathDatatype(path) === "date" &&
    (kind === "not before" || kind === "not after");

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
        <RulePart
          collection={TARGETS_LIST}
          label="Every"
          onChange={setTarget}
          value={target}
        />
        <RulePart
          collection={PATHS_LIST}
          label="must have"
          onChange={setPath}
          value={path}
        />
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
                        <TagsInputItem
                          index={index}
                          key={`${entry}-${index}`}
                          value={entry}
                        >
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
  const archive = useArchive();
  if (!archive) {
    return (
      <div className="p-3">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <OrdersBody archive={archive} />;
}

function OrdersBody({ archive }: { archive: Archive }) {
  const { select } = useGraphContext();
  const { coordinator } = useMosaic();
  const [source, setSource] = useState(DEFAULT_ORDERS);
  const [fileName, setFileName] = useState("amber-hall.orders");
  const [showSource, setShowSource] = useState(false);

  const { orders, unsupported, errors } = useMemo(
    () => compileOrders(source),
    [source]
  );

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
    deps: [orders.map((s) => s.id).join("|"), archive],
    query: () =>
      orders.length === 0
        ? null
        : // `sql` nests the compiler's predicate as a node rather than pasting its text: the
          // aggregate is the only SQL written here, and `s.failing` arrives already built.
          Query.from(archive.nodes).select(
            Object.fromEntries(
              orders.map((s, i) => [
                `c${i}`,
                sql`count(*) FILTER (WHERE ${s.failing})`,
              ])
            )
          ),
  });

  const countOf = (i: number) => Number(row?.[`c${i}`] ?? 0);
  /** No row yet: the counts are being queried, not zero. */
  const pending = row === undefined;
  const total = (severity: Severity) =>
    orders.reduce(
      (n, s, i) => (s.severity === severity ? n + countOf(i) : n),
      0
    );
  const violations = total("violation");
  const warnings = total("warning");

  /**
   * The ids an order fails, so pressing it can select them — and deliberately **unfiltered**.
   *
   * `coordinator.query` rather than a client, and `useChartQuery` above rather than this, and the
   * difference is the one `useChartQuery` documents: the counts beside each order are a readout
   * that must move with the page, so they are a client; this is a gesture that *produces* the
   * selection the page then moves by, so following the page would make it a function of itself.
   */
  const failingIds = async (order: Order) => {
    const data = await coordinator.query(
      Query.from(archive.nodes).select({ id: ID }).where(order.failing)
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
          <code className="truncate font-mono text-[10px] text-muted-foreground">
            {fileName}
          </code>
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
              <span className="text-muted-foreground">
                {" "}
                · {warnings} warnings
              </span>
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
                <GraphSelect
                  disabled={pending || clean}
                  label={`${order.target} ${order.constraint}`}
                  load={() => failingIds(order)}
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
                        !pending &&
                          (clean ? "bg-success" : SEVERITY_DOT[order.severity])
                      )}
                    />
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {order.target}
                    </code>
                    <span
                      className={cn(
                        "ms-auto text-xs tabular-nums",
                        pending && "text-muted-foreground"
                      )}
                    >
                      {pending ? "…" : clean ? "✓" : n}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px]">
                    {order.constraint}
                  </span>
                </GraphSelect>
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
              <p
                className="font-mono text-[10px] text-muted-foreground"
                key={message}
              >
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

/*
 * `Range` was here — a label, a value, a formatter and an Ark slider, written once and used eleven
 * times: five forces, a cluster pull, a node size, an edge opacity. Every one of those is a declared
 * `range` now, and `PreferencesSections` draws them from the declaration. A local control that
 * duplicates a library one is how a dock ends up disagreeing with the panel about what a preference
 * is called.
 */

// `sameDisplay` and `sameSim` were here, each comparing a store against a table of defaults to
// decide whether a reset was worth offering. Both are gone: what makes a reset worth offering is
// that something was STORED, which the resolution chain reports as `via` — and a comparison against
// the defaults would leave the button lit forever for every reader of a tenant who moved their
// starting point.

/**
 * What a gesture does, as a legend rather than a paragraph.
 *
 * The prose version was a run-on sentence with five `<kbd>`s buried in it. A reader scanning for
 * "how do I select two clusters" wants a table, and the library already ships the parts: `Kbd` for
 * a key, `KbdGroup` for a chord.
 */
const GESTURES: { keys: ReactNode; what: string }[] = [
  {
    keys: <Kbd>Drag</Kbd>,
    what: "Pan the canvas — or move a node",
  },
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
  {
    keys: <Kbd>Esc</Kbd>,
    what: "Back out — the drag, then the tool, then the selection",
  },
];

/**
 * The Settings panel: how the graph draws (`GraphLooks` — the presets and their axes), where the
 * points come from (`GraphPlacement`), and the gestures. The graph's settings live here, beside the
 * canvas they change, and not in the app's Preferences, which keep only what is app-wide. There are no forces here: the archive carries no
 * positions, so the layout runs when it loads, and the toolbar is where a reader pauses or re-runs
 * it. Fitting is the toolbar's too.
 */
export function GraphSettings() {
  const [placement, setPlacement] = usePlacement();
  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-4">
        <GraphLooks />
        <GraphPlacement onChange={setPlacement} value={placement} />

        <div className="space-y-2 border-t pt-3">
          <p className="font-medium text-muted-foreground text-xs">Gestures</p>
          <dl className="space-y-1.5">
            {GESTURES.map((gesture) => (
              <div className="flex items-baseline gap-2" key={gesture.what}>
                <dt className="shrink-0">{gesture.keys}</dt>
                <dd className="text-[11px] text-muted-foreground leading-snug">
                  {gesture.what}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Ask ──────────────────────────────────────────────────────────────────────

/**
 * The Ask panel — `@kanzo-tech/ai`'s `Chat` over `dataAgent`, whose model is a recording and whose
 * one tool queries the corpus for real.
 *
 * The split is deliberate and it is the only honest way to show this without a model: the
 * **language** is canned, the **answer** is not. The recording matches a question to an intent and
 * calls `query` with the intent's SQL over `scope`; the tool runs it on the page's coordinator under
 * the page's crossfilter, so the rows in the card are what the archive holds under the filter you
 * set, and the sentence after them is read off those rows. Nothing here pretends to have understood
 * anything it did not.
 *
 * Everything around the model is the real path, and it is the whole of what a host writes:
 * `describeSchema` with the corpus's `corpusReferences`, `dataAgent`, `dataSuggestions` streaming
 * the pills, `ChatSkeleton` while the schema loads, and `QueryResult` with the host's two actions.
 * Swapping the recording for `createGateway(…)("chat")` changes one line.
 */
interface Intent {
  /** Words that select this intent. */
  match: string[];
  question: string;
  rationale: string;
  /** The SQL the recording writes for it, over `scope`. */
  sql: string;
  /** The sentence, from the rows the model read back. */
  answer: (rows: Record<string, unknown>[]) => string;
}

/** Five years back from the world's own today, which is 14 September 1312 and never the clock. */
const FIVE_YEARS_BACK = isoDay(-5 * 365);

const INTENTS: Intent[] = [
  {
    match: ["old", "oldest", "long ago", "years", "before", "closed before"],
    question: "How many contracts closed more than five years ago?",
    rationale: "kind and closed",
    sql: `SELECT count(*) AS "contracts" FROM scope WHERE "kind" = 'contract' AND "closed" < DATE '${FIVE_YEARS_BACK}' LIMIT 1`,
    answer: (rows) => `${Number(rows[0]?.contracts ?? 0)} contracts in view were closed before ${FIVE_YEARS_BACK}.`,
  },
  {
    match: ["amber", "hall", "tenant", "whose"],
    question: "What does the Amber Hall hold, by kind?",
    rationale: "hall and kind",
    sql: `SELECT "kind", count(*) AS "nodes" FROM scope WHERE "hall" = 'amber' GROUP BY "kind" ORDER BY "nodes" DESC LIMIT 20`,
    answer: (rows) =>
      rows.length === 0
        ? "Nothing in view sits on the Amber Hall's arc."
        : `Mostly ${String(rows[0]?.kind)}s: ${Number(rows[0]?.nodes)} of them, beside ${rows.length - 1} other ${rows.length === 2 ? "kind" : "kinds"}.`,
  },
  {
    match: ["hub", "connected", "busiest", "central", "biggest", "most work"],
    question: "What holds the archive together?",
    rationale: "degree",
    sql: `SELECT "dense_id", "label", "kind", "degree" FROM scope WHERE "degree" >= 60 ORDER BY "degree" DESC LIMIT 100`,
    answer: (rows) =>
      rows.length === 0
        ? "Nothing in view touches 60 others or more."
        : `${rows.length} nodes touch 60 others or more; the busiest is ${String(rows[0]?.label)}.`,
  },
  {
    match: ["orphan", "unused", "tag", "lonely", "only one contract"],
    question: "Which tags does only one contract carry?",
    rationale: "kind and degree",
    sql: `SELECT "dense_id", "label", "degree" FROM scope WHERE "kind" = 'tag' AND "degree" < 2 ORDER BY "label" LIMIT 100`,
    answer: (rows) => `${rows.length} tags were used once and never again — a vocabulary of one.`,
  },
];

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

/** The rows the model was shown: the sample `dataAgent` hands it after `First rows: `. */
function rowsIn(message: { content: unknown } | undefined): Record<string, unknown>[] {
  const parts = Array.isArray(message?.content) ? (message.content as { type: string; output?: { value?: unknown } }[]) : [];
  const text = String(parts.find((part) => part.type === "tool-result")?.output?.value ?? "");
  const at = text.indexOf("First rows: ");
  try {
    return at < 0 ? [] : (JSON.parse(text.slice(at + "First rows: ".length)) as Record<string, unknown>[]);
  } catch {
    return [];
  }
}

/**
 * The recording. Asked for suggestions — `dataSuggestions`' instructions — it offers the intents'
 * questions; asked a question it recognises, it calls `query` with that intent's SQL, then reads the
 * sentence off the rows that come back. Anything else is said to be outside what it knows.
 */
const askModel = mockModel((call) => {
  if (promptOf(call).includes("You suggest questions")) {
    return JSON.stringify({ elements: INTENTS.map(({ question, rationale }) => ({ question, rationale })) });
  }
  const intent = match(askOf(call));
  if (!intent) return "That one is outside what this recording knows. Try one of the questions it starts with.";
  if (afterTool(call)) return intent.answer(rowsIn(call.prompt.at(-1)));
  return { reasoning: `Read as “${intent.question}”, which one query over \`scope\` answers.`, tool: "query", input: { sql: intent.sql } };
});

export function GraphAsk() {
  const archive = useArchive();
  const [schema, setSchema] = useState<DataSchema | null>(null);
  useEffect(() => {
    if (!archive) return;
    let live = true;
    // The host's half of the schema: the catalog, and the joins only the corpus knows.
    corpusReferences(archive.coordinator, FROM)
      .then((references) =>
        describeSchema(archive.coordinator, { catalog: FROM, exclude: ["fossil_tables", "fossil_columns"], references }),
      )
      .then((described) => live && setSchema(described), announce);
    return () => {
      live = false;
    };
  }, [archive]);
  if (!archive || schema === null) return <ChatSkeleton className="p-2" empty={<AskEmpty />} />;
  return <AskBody archive={archive} schema={schema} />;
}

function AskEmpty() {
  return (
    <EmptyRoot>
      <EmptyHeader>
        <EmptyIndicator>
          <SparklesIcon />
        </EmptyIndicator>
        <EmptyDescription className="text-xs">
          Ask about the graph. Every answer is a query over what is in view — the phrasing is canned,
          the rows are not.
        </EmptyDescription>
      </EmptyHeader>
    </EmptyRoot>
  );
}

/** Questions to start from, as they stream in: none on failure, and the chat works without them. */
function useStarters(schema: DataSchema, scope: DataScope) {
  const [state, setState] = useState<{ questions: string[]; suggesting: boolean }>({ questions: [], suggesting: true });
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      const questions: string[] = [];
      for await (const q of dataSuggestions({ model: askModel, schema, scope, abortSignal: abort.signal })) {
        questions.push(q.question);
        setState({ questions: [...questions], suggesting: true });
      }
      setState({ questions, suggesting: false });
    })().catch(() => !abort.signal.aborted && setState({ questions: [], suggesting: false }));
    return () => abort.abort();
  }, [schema, scope]);
  return state;
}

/**
 * The host's two actions on an answer that carries the archive's key: put its rows on the canvas,
 * or filter the page to them — a semi-join on identity, so every panel that shares the key follows.
 */
function AnswerActions({ output, source }: { output: QueryOutput; source: object }) {
  const { crossfilter } = useMosaic();
  if (!output.rows[0] || !(ID in output.rows[0])) return null;
  const ids = [...new Set(output.rows.map((row) => Number(row[ID])))];
  return (
    <>
      <GraphSelect label={output.sql} load={async () => ids}>
        <span className="text-xs">Show on graph</span>
      </GraphSelect>
      <Button
        onClick={() => crossfilter.update(clauseSemiJoin(ID, ids, { source, label: "Ask" }))}
        size="sm"
        variant="ghost"
      >
        Filter to these
      </Button>
    </>
  );
}

function AskBody({ archive, schema }: { archive: Archive; schema: DataSchema }) {
  const { coordinator, crossfilter } = useMosaic();
  const scope = useMemo<DataScope>(() => ({ selection: crossfilter, table: archive.nodes }), [crossfilter, archive]);
  const transport = useMemo(
    () => new DirectChatTransport({ agent: dataAgent({ model: askModel, coordinator, schema, scope, key: ID }) }),
    [coordinator, schema, scope],
  );
  const chat = useChat({ transport });
  const starters = useStarters(schema, scope);
  // What a `reset()` of the crossfilter calls back, and what retracts the clause the answer published.
  const [source] = useState(() => ({ reset: () => {} }));

  return (
    <div className="flex h-full flex-col p-2">
      <Chat
        chat={chat}
        empty={<AskEmpty />}
        suggesting={starters.suggesting}
        suggestions={starters.questions}
        tools={{ query: (part) => <QueryResult actions={(output) => <AnswerActions output={output} source={source} />} part={part} /> }}
        translations={{ placeholder: "Ask about your data…" }}
      />
    </div>
  );
}
