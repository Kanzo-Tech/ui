"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import type { SemiJoinMetadata } from "@kanzo-tech/mosaic";
import type { Selection, SelectionClause } from "@uwdata/mosaic-core";
import { XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { useMosaic } from "./mosaic-provider.js";

/**
 * What a selection holds, as removable chips. Read from `Selection.clauses`, so the row reports
 * filters it did not publish — a brush, a bar someone clicked, a lasso on a canvas. Over the page's
 * crossfilter it is the page's scope: what every client on it is filtered by, in a dock's header.
 */

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

function readable(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

/** A clause, as something a person can read. */
export function clauseLabel(clause: SelectionClause): string {
  // A field stringifies to its SQL identifier, quotes and all; the quoting is the database's.
  const name = clause.fields?.map((f) => String(f).replace(/^"|"$/g, "")).join(", ") ?? "filter";
  const value = clause.value;
  // A semi-join is named by its publisher — a lasso, a rule, a question — and counted when its
  // members are keys; a statement's members are not read into the page to be counted.
  if (clause.meta?.type === "semijoin") {
    const named = (clause.meta as SemiJoinMetadata).label ?? name;
    return Array.isArray(value) ? `${named} · ${value.length} selected` : named;
  }
  if (value == null) return name;
  if (Array.isArray(value)) {
    const [lo, hi] = value as [unknown, unknown];
    const range = (v: unknown) => typeof v === "number" || v instanceof Date;
    if (value.length === 2 && range(lo) && range(hi)) return `${name} ${readable(lo)} – ${readable(hi)}`;
    if (value.length === 1) return `${name} ${readable(Array.isArray(lo) ? lo[0] : lo)}`;
    return `${name} · ${value.length} selected`;
  }
  return `${name} ${readable(value)}`;
}

export interface FilterChipsProps extends React.ComponentProps<typeof ark.div> {
  /** The selection to read. Defaults to the provider's crossfilter. */
  selection?: Selection;
}

/** Renders nothing while the selection is empty. Removing a chip retracts its clause at the source. */
export function FilterChips(props: FilterChipsProps) {
  const { selection, className, slot, ...rest } = props;
  const { crossfilter, retract } = useMosaic();
  const clauses = useClauses(selection ?? crossfilter);
  if (clauses.length === 0) return null;

  return (
    <ark.div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "filter-chips"}
    >
      {clauses.map((clause, i) => {
        const label = clauseLabel(clause);
        return (
          <Badge className="gap-1 ps-2 pe-1" key={i} size="sm" variant="secondary">
            {label}
            <button
              aria-label={`Remove ${label}`}
              className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
              onClick={() => retract([clause])}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        );
      })}
    </ark.div>
  );
}
