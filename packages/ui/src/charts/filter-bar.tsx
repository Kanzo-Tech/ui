"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { bridged, clauseReadings, type TableExpr } from "@kanzo-tech/mosaic";
import { count, Query } from "@uwdata/mosaic-sql";
import type { Selection, SelectionClause } from "@uwdata/mosaic-core";
import { FunnelXIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Button } from "../simples/button.js";
import { ScrollArea } from "../simples/scroll-area.js";
import { Separator } from "../simples/separator.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { chartTableKey } from "./chart-spec.js";
import { useBarSlot, useMosaic, type BarHeld } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

/** The live clause list of a selection, re-read on every published value. */
export function useClauses(selection: Selection): readonly SelectionClause[] {
  const [clauses, setClauses] = useState<readonly SelectionClause[]>([]);
  useEffect(() => {
    const sync = () => setClauses([...selection.clauses]);
    sync();
    selection.addEventListener("value", sync);
    return () => selection.removeEventListener("value", sync);
  }, [selection]);
  return clauses;
}

/** The one column a clause names, unquoted, or `null` for a clause over several or none. */
export function clauseField(clause: SelectionClause): string | null {
  const fields = clause.fields;
  return fields?.length === 1 ? String(fields[0]).replace(/^"|"$/g, "") : null;
}

const isHeld = (held: readonly BarHeld[], clause: SelectionClause) => {
  const field = clauseField(clause);
  return field !== null && held.some((h) => h.fields.includes(field) && h.selection.clauses.includes(clause));
};

export interface FilterBarProps extends React.ComponentProps<typeof ark.section> {
  /** The relation the readout counts: *611 of 1,528 people*. Without it the bar has no readout. */
  table?: TableExpr;
  /** What a row of `table` is, in the plural. Default `"rows"`. */
  rowNoun?: string;
  /** Trailing controls, pinned at the end after the readout. */
  children?: ReactNode;
}

/**
 * **The page's one row of filters**, under its header — Metabase's filter bar, drawn as Linear's
 * chips. Every clause on the page's crossfilter is a chip that retracts it where it was published,
 * read from `Selection.clauses`, so the row reports filters it did not publish: a brush, a lasso, a
 * pick. A clause a bridge mapped — a dashboard's tiles as one semi-join — is its parts, each named
 * after it: *Dashboard creationDate 2011 – 2012*, and once where the part already reads as the
 * bridge's name: a timeline's window is *date 1910 – 1940*.
 *
 * **It is one line at any count.** The chips scroll sideways under a fade at the edge that hides
 * more, and a chip added on its own is scrolled to. The verbs are pinned after a hairline, as icons:
 * whatever a part puts there, *Clear every filter* — which retracts every clause on the page, whoever
 * published it, and is disabled rather than gone while there is none — then the readout of what the
 * filters keep of `table`, then `children`.
 *
 * Other parts draw in it through two slots: a `Dashboard` puts its filters among the chips, as chips
 * that open their control, and *Add a filter* among the verbs; the bar leaves those clauses to them.
 */
export function FilterBar(props: FilterBarProps) {
  const { table, rowNoun = "rows", children, className, slot, ...rest } = props;
  const { crossfilter, retract, reset } = useMosaic();
  const { held, place, placeActions } = useBarSlot();
  const row = useRevealAdded();
  const clauses = useClauses(crossfilter);
  const chips = clauses.flatMap((clause) => {
    const made = bridged(clause);
    // Each part as `clauseReadings` reads it — the same words Ask gives the model for this filter.
    return clauseReadings(clause)
      .filter(({ part }) => !isHeld(held, part))
      .map(({ part, label }) => ({ label, remove: () => (made ? made.retract([part]) : retract([part])) }));
  });

  const seen = new Map<string, number>();
  const keyed = chips.map((chip) => {
    const n = seen.get(chip.label) ?? 0;
    seen.set(chip.label, n + 1);
    // By label, so a chip keeps its element while others come and go, and a new one is a new element.
    return { ...chip, key: `${chip.label}#${n}` };
  });

  return (
    <ark.section
      aria-label="Filters"
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "filter-bar"}
    >
      <ScrollArea className="min-w-0 flex-1" scrollFade>
        {/* `p-1` is room for a focus ring: the scrolling viewport clips on both axes. */}
        <ark.div className="flex w-max items-center gap-2 p-1" data-slot="filter-bar-row" ref={row}>
          {keyed.map(({ key, label, remove }) => (
            <Badge className="gap-1 ps-2 pe-1" key={key} size="sm" variant="secondary">
              {label}
              <button
                aria-label={`Remove ${label}`}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                onClick={remove}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <ark.div className="contents" data-slot="filter-bar-slot" ref={place} />
          {keyed.length === 0 ? (
            // Shown while the slot is empty too; a selector, because only the DOM knows what a part drew there.
            <span className="hidden text-muted-foreground text-xs [[data-slot=filter-bar-slot]:empty+&]:inline">
              No filters
            </span>
          ) : null}
        </ark.div>
      </ScrollArea>
      <Separator className="h-4" orientation="vertical" />
      <ark.div className="flex shrink-0 items-center gap-1" data-slot="filter-bar-actions">
        <ark.div className="contents" data-slot="filter-bar-actions-slot" ref={placeActions} />
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Disabled rather than gone, so nothing beside it moves when the first filter lands. */}
            <Button aria-label="Clear every filter" disabled={clauses.length === 0} onClick={() => reset()} size="icon-sm" variant="ghost">
              <FunnelXIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear every filter</TooltipContent>
        </Tooltip>
        {table ? <Readout rowNoun={rowNoun} table={table} /> : null}
        {children}
      </ark.div>
    </ark.section>
  );
}

/**
 * Scrolls a chip added on its own into view, whether the bar drew it or a part did through the slot.
 * A batch of several — the page's first draw, a dashboard's filters arriving — is left where it
 * starts. By `scrollLeft` on the viewport alone, not `scrollIntoView`, which also scrolls the page to
 * the bar while the reader brushes a chart below it.
 */
function useRevealAdded() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const viewport = row?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!row || !viewport) return;
    const observer = new MutationObserver((records) => {
      const added = records
        .flatMap((r) => [...r.addedNodes])
        .filter((n): n is HTMLElement => n instanceof HTMLElement && (n.parentElement === row || n.parentElement?.parentElement === row));
      const [chip] = added;
      if (added.length !== 1 || !chip) return;
      const v = viewport.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      viewport.scrollLeft += c.left < v.left ? c.left - v.left : c.right > v.right ? c.right - v.right : 0;
    });
    observer.observe(row, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Readout({ table, rowNoun }: { table: TableExpr; rowNoun: string }) {
  const key = chartTableKey(table);
  const shown = useChartQuery({ deps: [key], query: (filter) => Query.from(table).select({ n: count() }).where(filter) });
  const all = useChartQuery({ deps: [key], filterBy: null, query: () => Query.from(table).select({ n: count() }) });
  const rows = Number(shown.row?.n ?? 0);
  const total = Number(all.row?.n ?? 0);
  return (
    <span aria-busy={all.rows === null || shown.rows === null || undefined} className="px-1 text-muted-foreground text-xs tabular-nums" role="status">
      {all.rows === null
        ? "Counting…"
        : rows === total
          ? `${total.toLocaleString()} ${rowNoun}`
          : `${rows.toLocaleString()} of ${total.toLocaleString()} ${rowNoun}`}
    </span>
  );
}
