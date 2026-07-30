"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import {
  clauseInterval,
  clauseMatch,
  clausePoint,
  clausePoints,
  MosaicClient,
  type Selection,
  type SelectionClause,
} from "@uwdata/mosaic-core";
import {
  count as sqlCount,
  desc as sqlDesc,
  max as sqlMax,
  min as sqlMin,
  Query,
  type FilterExpr,
} from "@uwdata/mosaic-sql";
import { useListCollection } from "@ark-ui/react/collection";
import { useFilter } from "@ark-ui/react/locale";
import { cn } from "../lib/cn.js";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
} from "../simples/combobox.js";
import { FacetFilter, type FacetFilterItem } from "../simples/FacetFilter.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { Skeleton } from "../simples/skeleton.js";
import { Slider, SliderLabel, SliderValue } from "../simples/slider.js";
import { useMosaic } from "./mosaic-provider.js";
import { ChartQueryClient, type ChartQueryRow as QueryRow } from "./query-client.js";

/**
 * Mosaic **inputs** — controls that publish into a `Selection` without being charts.
 *
 * Unlike marks and interactors, these are real DOM parts (`ark.*`, `data-slot`, forwarded props),
 * not inert descriptors: they carry no `__chart` static and belong *outside* `<ChartRoot>`. What
 * makes them Mosaic and not just a styled `<select>` is that each one is a `MosaicClient`: it
 * declares a `query()` for the values it needs (grouped counts, distinct values, a numeric extent),
 * the coordinator answers it, and the control publishes `clausePoints` / `clauseMatch` /
 * `clauseInterval` back into the selection the charts filter by.
 *
 * The vgplot equivalents (`vg.menu`, `vg.search`, `vg.slider`) build raw HTML. These use our
 * controls, our tokens and our accessibility, and are controllable *and* observable: an external
 * change to the selection flows back into the widget.
 */


export interface MosaicInputOptions<T> {
  /** Filters the widget's own lookup query. `null` = the full relation. */
  filterBy: Selection | null;
  /** Where the widget publishes. `null` = nowhere. */
  as: Selection | null;
  /** The lookup query, or `null` when there is nothing to ask the coordinator for. */
  build: (filter: FilterExpr) => Query | null;
  /** Rebuilds the client — and re-runs the lookup — when any entry changes. */
  deps: readonly unknown[];
  clause: (source: MosaicClient, value: T | undefined) => SelectionClause;
  /** The representative value of the warm-up clause published on hover/focus. */
  activateValue: T;
  /** Reads the widget's own clause value back out of the selection. Defaults to an identity cast. */
  decode?: (value: unknown) => T;
}

export interface MosaicInputState<T> {
  /** Lookup rows, or `null` while the query is in flight (or when there is no query). */
  rows: readonly QueryRow[] | null;
  /** The value this widget currently holds in the selection — its observable half. */
  selected: T | undefined;
  publish: (value: T | undefined) => void;
  activate: () => void;
}

/**
 * The conversation with Mosaic that every input in this file has: a lookup query that re-runs under
 * the crossfilter, a clause published with `source` set so a control never filters itself, and a
 * warm-up so the first interaction is not the first query.
 *
 * Exported because the three controls here are surfaces over it, not the only surfaces it allows —
 * a chip row, a segmented switch or a map lasso is the same conversation with different chrome, and
 * without this the alternative is reimplementing it.
 */
export function useMosaicInput<T>(
  options: MosaicInputOptions<T>
): MosaicInputState<T> {
  const { filterBy, as, deps } = options;
  const { coordinator } = useMosaic();
  const latest = useRef(options);
  latest.current = options;

  const clientRef = useRef<ChartQueryClient | null>(null);
  const [client, setClient] = useState<ChartQueryClient | null>(null);
  const [rows, setRows] = useState<readonly QueryRow[] | null>(null);
  const [selected, setSelected] = useState<T | undefined>(undefined);

  useEffect(() => {
    const instance = new ChartQueryClient(
      filterBy ?? undefined,
      (filter) => latest.current.build(filter),
      setRows,
    );
    clientRef.current = instance;
    setRows(null);
    setClient(instance);
    coordinator.connect(instance);
    return () => {
      clientRef.current = null;
      coordinator.disconnect(instance);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator, filterBy, ...deps]);

  useEffect(() => {
    if (!as || !client) return;
    const sync = () => {
      const raw = as.valueFor(client);
      const { decode } = latest.current;
      setSelected(raw === undefined ? undefined : decode ? decode(raw) : (raw as T));
    };
    sync();
    as.addEventListener("value", sync);
    return () => {
      as.removeEventListener("value", sync);
      // `Selection.remove` returns a *clone*; the live way to retract a clause is to publish an
      // empty one, which the resolver drops because its predicate is null.
      if (as.valueFor(client) !== undefined) as.update(latest.current.clause(client, undefined));
    };
  }, [as, client]);

  const publish = useCallback(
    (value: T | undefined) => {
      setSelected(value);
      const instance = clientRef.current;
      if (as && instance) as.update(latest.current.clause(instance, value));
    },
    [as],
  );

  const activate = useCallback(() => {
    const instance = clientRef.current;
    if (as && instance) as.activate(latest.current.clause(instance, latest.current.activateValue));
  }, [as]);

  return { rows, selected, publish, activate };
}

/** vgplot's inputs warm the selection on hover/focus; ours do it on the wrapper, and compose. */
function warmUpHandlers(
  activate: () => void,
  props: Pick<React.ComponentProps<typeof ark.div>, "onFocus" | "onPointerEnter">,
) {
  return {
    onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
      props.onFocus?.(event);
      activate();
    },
    onPointerEnter: (event: React.PointerEvent<HTMLDivElement>) => {
      props.onPointerEnter?.(event);
      if (!event.buttons) activate();
    },
  };
}

interface SelectionProps {
  /** Where the control publishes. Defaults to the provider's crossfilter; `null` = nowhere. */
  as?: Selection | null;
  /** What the control's own lookup filters by. Defaults to the crossfilter; `null` = unfiltered. */
  filterBy?: Selection | null;
}

type ControlSize = "sm" | "md" | "lg";

// ── ChartFilter ──────────────────────────────────────────────────────────────

/** An explicit entry. Bare values work too — they are labelled by `format`. */
export interface ChartFilterOption {
  value: unknown;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ChartFilterProps
  extends Omit<React.ComponentProps<typeof ark.div>, "defaultValue">,
    SelectionProps {
  /** The relation the values and their counts come from. */
  table?: string;
  /** The column grouped by. */
  column?: string;
  /** The column named in the published clause. Defaults to `column`. */
  field?: string;
  /** Explicit options — a literal value or a `{ value, label, icon }` object. Skips the lookup. */
  options?: readonly unknown[];
  /** Labels an option value that carries no explicit label. */
  format?: (value: unknown) => string;
  /** Trigger label. Defaults to `column`. */
  label?: ReactNode;
  /** Tick any number of values (an `IN` list). `false` keeps at most one ticked. */
  multiple?: boolean;
  /** Published once, when the control first connects. A bare value or an array of them. */
  defaultValue?: unknown;
  /** Most-frequent values kept; past this the list says so rather than rendering the tail. */
  limit?: number;
  /**
   * Draw a filter field above the values.
   *
   * It narrows **the fetched page** — the `limit` most frequent values this control asked for — and
   * runs no query of its own. When the page is truncated the note and the no-match message say so,
   * because a field that answers "no matching values" about a database it never asked is worse than
   * no field. Searching the column itself is `ChartSearch`, which publishes a match clause.
   *
   * @default false
   */
  searchable?: boolean;
  disabled?: boolean;
  size?: ControlSize;
  /** Class for the trigger; `className` styles the wrapper. */
  controlClassName?: string;
}

/**
 * A `GROUP BY` over a high-cardinality column can answer with thousands of rows, and neither the
 * wire nor the DOM wants them. The lookup is capped at the *most frequent* values — the ones a
 * facet is for — and the control owns up to the truncation instead of pretending the tail is
 * absent. Needle-in-a-haystack lookup is `ChartSearch`'s job, not a facet filter's.
 */
const FILTER_LIMIT = 50;

interface FilterEntry {
  key: string;
  label: string;
  raw: unknown;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

function isOptionObject(value: unknown): value is ChartFilterOption {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value;
}

function defaultFormat(value: unknown): string {
  return String(value ?? "");
}

/** DuckDB answers a `count(*)` with a BigInt over the WASM bridge. */
function toCount(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return undefined;
}

function truncationNote(truncated: boolean, limit: number, searchable: boolean) {
  if (!truncated) return undefined;
  return searchable
    ? `Top ${limit} values — the field searches these, not the column. Filter further for the rest.`
    : `Top ${limit} values — filter further to see the rest.`;
}

function filterEntries(
  options: readonly unknown[] | undefined,
  rows: readonly QueryRow[] | null,
  format: (value: unknown) => string,
): FilterEntry[] {
  if (options) {
    return options.map((entry) => {
      const option = isOptionObject(entry) ? entry : { value: entry };
      return {
        key: String(option.value),
        label: option.label ?? format(option.value),
        raw: option.value,
        icon: option.icon,
      };
    });
  }
  return (rows ?? []).map((row) => ({
    key: String(row.value),
    label: format(row.value),
    raw: row.value,
    count: toCount(row.count),
  }));
}

/**
 * A facet filter over a column's values, publishing a **points** clause — the same `FacetFilter`
 * surface as the table's, so a dashboard has one filter idiom rather than two.
 *
 * The values are a query, not a prop: the control connects as a Mosaic client and asks for
 * `SELECT <column>, count(*) … GROUP BY <column>` filtered by `filterBy`. The counts therefore
 * react to the *other* filters but not to this one — a crossfilter resolver drops a clause when it
 * builds the predicate for the clause's own source, and `clausePoints` tags the clause with this
 * client. (A non-crossfilter `filterBy` has no such exemption and would count itself.)
 */
export function ChartFilter(props: ChartFilterProps) {
  const {
    table,
    column,
    field = column,
    as,
    filterBy,
    options,
    format = defaultFormat,
    label = column,
    multiple = true,
    defaultValue,
    limit = FILTER_LIMIT,
    searchable = false,
    disabled,
    size = "md",
    className,
    controlClassName,
    children,
    ...rest
  } = props;
  const { crossfilter } = useMosaic();
  const target = as === undefined ? crossfilter : as;
  const source = filterBy === undefined ? crossfilter : filterBy;
  const lookup = options === undefined && Boolean(table && column);

  const { rows, selected, publish, activate } = useMosaicInput<readonly unknown[]>({
    as: target,
    filterBy: source,
    deps: [table, column, lookup, limit],
    activateValue: [0],
    build: (filter) =>
      lookup
        ? Query.from(table as string)
            .select({ value: column as string, count: sqlCount() })
            .where(filter)
            .groupby(column as string)
            .orderby(sqlDesc(sqlCount()), column as string)
            // One past the cap: enough to know the tail exists without asking a second question.
            .limit(limit + 1)
        : null,
    clause: (client, value) =>
      multiple
        ? clausePoints([field as string], value?.map((entry) => [entry]), { source: client })
        : clausePoint(field as string, value?.[0], { source: client }),
    decode: (value) => (multiple ? (value as unknown[][]).map((tuple) => tuple[0]) : [value]),
  });

  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || defaultValue === undefined) return;
    primed.current = true;
    publish(Array.isArray(defaultValue) ? (defaultValue as unknown[]) : [defaultValue]);
  }, [defaultValue, publish]);

  const values = selected ?? [];

  const fetched = filterEntries(options, rows, format);
  const truncated = fetched.length > limit;
  const entries = truncated ? fetched.slice(0, limit) : fetched;
  const items: FacetFilterItem[] = entries.map((entry) => ({
    count: entry.count,
    icon: entry.icon,
    label: entry.label,
    value: entry.key,
  }));

  // `FacetFilter` speaks strings; a clause carries the raw value the query answered with, so the
  // way back from a ticked row to `alpha` / `3` / `true` is this map. The selected values are in it
  // too: one of them may be a value the crossfilter has since faceted away, which `FacetFilter`
  // keeps listed so it can still be unticked.
  const raw = new Map<string, unknown>(entries.map((entry) => [entry.key, entry.raw]));
  for (const value of values) raw.set(String(value), value);

  return (
    <ark.div
      className={cn("w-fit", className)}
      data-slot="chart-filter"
      {...rest}
      {...warmUpHandlers(activate, props)}
    >
      <FacetFilter
        className={controlClassName}
        data-slot="chart-filter-trigger"
        disabled={disabled}
        empty={lookup && rows === null ? "Loading…" : "No values."}
        items={items}
        label={label}
        multiple={multiple}
        // A search field over a truncated list is a half-truth unless it names its own scope, so
        // both messages change when the tail was dropped: the field covers the fetched page, and a
        // miss inside it says nothing about the column.
        note={truncationNote(truncated, limit, searchable)}
        onValueChange={(next) => publish(next.map((key) => (raw.has(key) ? raw.get(key) : key)))}
        searchEmpty={truncated ? `No match among the top ${limit} values.` : undefined}
        searchable={searchable}
        size={size}
        value={values.map((value) => String(value))}
      />
      {children}
    </ark.div>
  );
}

// ── ChartSearch ──────────────────────────────────────────────────────────────

export interface ChartSearchProps
  extends Omit<React.ComponentProps<typeof ark.div>, "defaultValue">,
    SelectionProps {
  /** The relation the autocomplete values come from. */
  table?: string;
  /** The column to search. */
  column?: string;
  /** The column named in the published clause. Defaults to `column`. */
  field?: string;
  /** Where the query string has to appear. */
  type?: "contains" | "prefix" | "suffix" | "regexp";
  caseSensitive?: boolean;
  label?: ReactNode;
  placeholder?: string;
  /** ms of quiet before publishing. `0` publishes on every keystroke, as vgplot does. */
  debounce?: number;
  /** Distinct values offered as a native autocomplete list. `0` skips the lookup entirely. */
  autocompleteLimit?: number;
  defaultValue?: string;
  disabled?: boolean;
  size?: ControlSize;
  /** Class for the control; `className` styles the wrapper. */
  controlClassName?: string;
}

/**
 * A text box publishing a **match** clause (`contains` / `prefix` / `suffix` / `regexp`).
 *
 * Every keystroke is a query, so the publish is debounced by default. The distinct values of the
 * column feed a native `<datalist>`, exactly as vgplot's `search` does — and, as there, the list
 * narrows with the query, since a match clause does not exempt its own client from the crossfilter.
 */
export function ChartSearch(props: ChartSearchProps) {
  const {
    table,
    column,
    field = column,
    as,
    filterBy,
    type = "contains",
    caseSensitive = false,
    label,
    placeholder = "Search…",
    debounce = 200,
    autocompleteLimit = 100,
    defaultValue,
    disabled,
    size = "md",
    className,
    controlClassName,
    children,
    ...rest
  } = props;
  const { crossfilter } = useMosaic();
  const target = as === undefined ? crossfilter : as;
  const source = filterBy === undefined ? crossfilter : filterBy;
  const lookup = autocompleteLimit > 0 && Boolean(table && column);

  const { rows, selected, publish, activate } = useMosaicInput<string>({
    as: target,
    filterBy: source,
    deps: [table, column, lookup, autocompleteLimit],
    activateValue: "",
    build: (filter) =>
      lookup
        ? Query.from(table as string)
            .select({ value: column as string })
            .distinct()
            .where(filter)
            .orderby(column as string)
            .limit(autocompleteLimit)
        : null,
    clause: (client, value) =>
      clauseMatch(field as string, value ?? null, { source: client, method: type, caseSensitive }),
  });

  // The completions, filtered in the browser. The query already asked the database for the
  // `autocompleteLimit` distinct values of the column; narrowing THOSE as you type is not a second
  // question, so it does not become a second query.
  const items = useMemo(
    () => (rows ?? []).map((row) => ({ label: String(row.value), value: String(row.value) })),
    [rows],
  );
  const capped = items.length >= autocompleteLimit;
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter: completions, set } = useListCollection<{
    label: string;
    value: string;
  }>({ filter: contains, initialItems: [] });

  // Keyed on the values, not on the array: `rows` is a fresh array on every settled query, and
  // setting the collection from an identity-unstable dep is a render loop.
  const itemsKey = items.map((item) => item.value).join(" ");
  useEffect(() => {
    set(items);
    // `items` is derived from `itemsKey`; depending on it directly is the loop above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, set]);

  const [text, setText] = useState(defaultValue ?? "");
  const published = useRef(defaultValue ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const external = selected ?? "";
    if (external !== published.current) {
      published.current = external;
      setText(external);
    }
  }, [selected]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !defaultValue) return;
    primed.current = true;
    publish(defaultValue);
  }, [defaultValue, publish]);

  const change = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    const send = () => {
      published.current = next;
      publish(next || undefined);
    };
    if (debounce > 0) timer.current = setTimeout(send, debounce);
    else send();
  };

  return (
    <Field
      className={cn("w-fit min-w-48 gap-1.5", className)}
      data-slot="chart-search"
      disabled={disabled}
      {...rest}
      {...warmUpHandlers(activate, props)}
    >
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {lookup ? (
        // `allowCustomValue`, because this control is a FILTER and not a picker: what it publishes
        // is a match clause over whatever you typed, and the list only ever offered completions.
        // A `<datalist>` was the honest first answer to that and a poor one — unstyleable, different
        // in every browser, no empty state, and silent about its own cap. Same clause, same
        // debounce; only the surface changed.
        <Combobox
          allowCustomValue
          collection={collection}
          data-slot="chart-search-list"
          disabled={disabled}
          inputValue={text}
          onInputValueChange={(details) => {
            completions(details.inputValue);
            change(details.inputValue);
          }}
          onValueChange={(details) => {
            const picked = details.value[0];
            if (picked !== undefined) change(picked);
          }}
        >
          <ComboboxInput className={controlClassName} placeholder={placeholder} size={size} />
          <ComboboxContent>
            <ComboboxEmpty>No matching values.</ComboboxEmpty>
            {collection.items.map((item) => (
              <ComboboxItem item={item} key={item.value}>
                {item.label}
              </ComboboxItem>
            ))}
            {/* The cap, said out loud. The datalist could not: it silently stopped at its limit,
                so "nothing else matches" and "nothing else was asked for" looked identical. */}
            {capped ? (
              <p className="border-t px-2 py-1.5 text-muted-foreground text-xs">
                First {autocompleteLimit}. Keep typing to narrow it.
              </p>
            ) : null}
          </ComboboxContent>
        </Combobox>
      ) : (
        <Input
          className={controlClassName}
          disabled={disabled}
          onChange={(event) => change(event.target.value)}
          placeholder={placeholder}
          size={size}
          type="search"
          value={text}
        />
      )}
      {children}
    </Field>
  );
}

// ── ChartSlider ──────────────────────────────────────────────────────────────

export interface ChartSliderProps
  extends Omit<React.ComponentProps<typeof ark.div>, "defaultValue">,
    SelectionProps {
  /** The relation the extent comes from, when `min`/`max` are not both given. */
  table?: string;
  /** The numeric column. */
  column?: string;
  /** The column named in the published clause. Defaults to `column`. */
  field?: string;
  /**
   * `point` publishes an equality clause for one thumb; `interval` publishes a two-thumb range.
   * (vgplot's slider only ever offers `[min, value]`; ours brushes a real interval.)
   */
  select?: "point" | "interval";
  min?: number;
  max?: number;
  step?: number;
  /** Published once, when the control first connects. */
  defaultValue?: number | readonly [number, number];
  label?: ReactNode;
  /** Show the current value beside the label. */
  showValue?: boolean;
  disabled?: boolean;
}

type SliderValueType = number | readonly [number, number];

interface SliderExtent {
  min: number;
  max: number;
  step: number;
}

/** vgplot's `(max - min) / 500`, except an all-integer extent steps by 1 — 500 fractions of a count is noise. */
function defaultStep(min: number, max: number): number {
  if (Number.isInteger(min) && Number.isInteger(max)) return 1;
  return (max - min) / 500 || 1;
}

/**
 * A slider over a numeric column, publishing a **point** or **interval** clause.
 *
 * The extent is a query when `min`/`max` are not both given: `SELECT min(col), max(col)`, answered
 * by the coordinator. A `Skeleton` shaped like the track holds the space until it arrives.
 */
export function ChartSlider(props: ChartSliderProps) {
  const {
    table,
    column,
    field = column,
    as,
    filterBy,
    select = "point",
    min,
    max,
    step,
    defaultValue,
    label,
    showValue = true,
    disabled,
    className,
    children,
    ...rest
  } = props;
  const { crossfilter } = useMosaic();
  const target = as === undefined ? crossfilter : as;
  const source = filterBy === undefined ? crossfilter : filterBy;
  const lookup = (min === undefined || max === undefined) && Boolean(table && column);
  // The binning hint for the interval clause. A ref, not `extent` itself: reading the memo from
  // the clause would make the widget's own row type circular.
  const pixelSize = useRef(1);

  const { rows, selected, publish, activate } = useMosaicInput<SliderValueType>({
    as: target,
    filterBy: source,
    deps: [table, column, lookup],
    activateValue: select === "interval" ? ([0, 0] as const) : 0,
    build: (filter) =>
      lookup
        ? Query.select({ min: sqlMin(column as string), max: sqlMax(column as string) })
            .from(table as string)
            .where(filter)
        : null,
    clause: (client, value) => {
      if (select !== "interval") return clausePoint(field as string, value, { source: client });
      const domain = value as [number, number] | undefined;
      return clauseInterval(field as string, domain ?? null, {
        source: client,
        bin: "ceil",
        scale: domain ? { type: "identity", domain } : undefined,
        pixelSize: pixelSize.current,
      });
    },
  });

  const extent = useMemo<SliderExtent | null>(() => {
    const row = rows?.[0];
    const low = min ?? (typeof row?.min === "number" ? row.min : undefined);
    const high = max ?? (typeof row?.max === "number" ? row.max : undefined);
    if (low === undefined || high === undefined) return null;
    return { min: low, max: high, step: step ?? defaultStep(low, high) };
  }, [rows, min, max, step]);

  useEffect(() => {
    pixelSize.current = extent?.step ?? 1;
  }, [extent]);

  const [values, setValues] = useState<number[] | null>(
    defaultValue === undefined ? null : [...toValues(defaultValue)],
  );
  /** Distinguishes "never published" from "published and then cleared" — see the effect below. */
  const held = useRef(false);

  useEffect(() => {
    if (selected !== undefined) {
      held.current = true;
      setValues([...toValues(selected)]);
      return;
    }
    // The clause is gone: a `Selection.reset()`, a "Clear filters" button, another control
    // retracting it. Fall back to the extent instead of leaving the thumbs where they were — a
    // slider that still reads 5–22 while nothing is filtered is a control lying about the state,
    // which is worse than one that never moved. Gated on `held` so the first render does not
    // stomp on `defaultValue` before the priming effect has published it.
    if (held.current) {
      held.current = false;
      setValues(null);
    }
  }, [selected]);

  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || defaultValue === undefined) return;
    primed.current = true;
    publish(defaultValue);
  }, [defaultValue, publish]);

  const change = (next: number[]) => {
    setValues(next);
    publish(select === "interval" ? [next[0] as number, next[1] as number] : (next[0] as number));
  };

  const shown = values ?? (extent ? (select === "interval" ? [extent.min, extent.max] : [extent.min]) : null);

  return (
    <ark.div
      className={cn("flex w-full min-w-48 flex-col gap-1.5", className)}
      data-slot="chart-slider"
      {...rest}
      {...warmUpHandlers(activate, props)}
    >
      {extent && shown ? (
        <Slider
          disabled={disabled}
          max={extent.max}
          min={extent.min}
          onValueChange={(details) => change(details.value)}
          step={extent.step}
          value={shown}
        >
          {label || showValue ? (
            <div className="flex items-center">
              {label ? <SliderLabel>{label}</SliderLabel> : null}
              {showValue ? <SliderValue /> : null}
            </div>
          ) : null}
        </Slider>
      ) : (
        <Skeleton className="h-2 w-full rounded-full" />
      )}
      {children}
    </ark.div>
  );
}

function toValues(value: SliderValueType): readonly number[] {
  return typeof value === "number" ? [value] : value;
}
