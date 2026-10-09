"use client";

import { useEffect, useState, type ReactNode } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { bridged, clauseLabel, clauseParts, type TableExpr } from "@kanzo-tech/mosaic";
import { count, Query } from "@uwdata/mosaic-sql";
import type { Selection, SelectionClause } from "@uwdata/mosaic-core";
import { XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Button } from "../simples/button.js";
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
  /** Trailing controls, after *Clear*. */
  children?: ReactNode;
}

/**
 * **The page's one row of filters**, under its header — Metabase's filter bar, drawn as Linear's
 * chips. Every clause on the page's crossfilter is a chip that retracts it where it was published,
 * read from `Selection.clauses`, so the row reports filters it did not publish: a brush, a lasso, a
 * pick. A clause a bridge mapped — a dashboard's tiles as one semi-join — is its parts, each named
 * after it: *Dashboard creationDate 2011 – 2012*.
 *
 * Other parts draw in it through a slot: a `Dashboard` puts its filters and *+ Filter* here, as
 * chips that open their control, and the bar leaves those clauses to them. The readout says what the
 * filters keep of `table`, and *Clear* retracts every clause on the page, whoever published it.
 */
export function FilterBar(props: FilterBarProps) {
  const { table, rowNoun = "rows", children, className, slot, ...rest } = props;
  const { crossfilter, retract, reset } = useMosaic();
  const { held, place } = useBarSlot();
  const clauses = useClauses(crossfilter);
  const chips = clauses.flatMap((clause) => {
    const made = bridged(clause);
    if (!made) return isHeld(held, clause) ? [] : [{ label: clauseLabel(clause), remove: () => retract([clause]) }];
    const { field } = clauseParts(clause);
    return made.parts
      .filter((part) => !isHeld(held, part))
      .map((part) => ({ label: `${field} ${clauseLabel(part)}`, remove: () => made.retract([part]) }));
  });

  return (
    <ark.section
      aria-label="Filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "filter-bar"}
    >
      {chips.map(({ label, remove }, i) => (
        <Badge className="gap-1 ps-2 pe-1" key={i} size="sm" variant="secondary">
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
      <div className="contents" data-slot="filter-bar-slot" ref={place} />
      <div className="ms-auto flex items-center gap-1">
        {table ? <Readout rowNoun={rowNoun} table={table} /> : null}
        {clauses.length > 0 ? (
          <Button onClick={() => reset()} size="sm" variant="ghost">
            Clear
          </Button>
        ) : null}
        {children}
      </div>
    </ark.section>
  );
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
