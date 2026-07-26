"use client";

import { useEffect, useState } from "react";
import type { Selection, SelectionClause } from "@kanzo-tech/ui/analytics";
import { Badge } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";

/**
 * What a crossfilter currently holds, as removable chips.
 *
 * `Selection.clauses` is the read model `MosaicProvider` documents ("a filter-chip row or a
 * readout"), and reading it is what lets a panel report filters it did not publish — a brush on a
 * plot, a bar someone clicked, a lasso around a cluster. Two showcases needed it, so per DESIGN.md's
 * ladder it is a frame in `docs/lib/`, not a component in the library.
 */

/** A clause, as something a person can read. */
export function clauseLabel(clause: SelectionClause): string {
  // A field stringifies to its SQL identifier, quotes and all — `"provider"` reads as a defect on a
  // chip, so the quoting the database needs is stripped for the reader.
  const field = clause.fields?.map((f) => String(f).replace(/^"|"$/g, "")).join(", ") ?? "filter";
  const value = clause.value;
  if (value == null) return field;
  if (Array.isArray(value)) {
    // An interval is [lo, hi]; a points clause is an array of one-column tuples.
    const [lo, hi] = value as [unknown, unknown];
    if (value.length === 2 && typeof lo === "number" && typeof hi === "number") {
      return `${field} ${lo.toFixed(1)} – ${hi.toFixed(1)}`;
    }
    if (value.length === 1) return `${field} ${String(Array.isArray(lo) ? lo[0] : lo)}`;
    return `${field} · ${value.length} selected`;
  }
  return `${field} ${String(value)}`;
}

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

/**
 * Retract one clause.
 *
 * The same move a widget makes to clear its own filter: publish an empty clause from the same
 * source and the resolver drops it, because its predicate is null. A source that owns a `reset` —
 * a `Selection.single()` behind a picking chart — gets to use it instead, which also clears the
 * widget's state rather than just the filter.
 */
export function dropClause(selection: Selection, clause: SelectionClause): void {
  const source = clause.source as { reset?: () => void };
  if (typeof source.reset === "function") source.reset();
  else selection.update({ ...clause, value: undefined, predicate: null });
}

export interface FilterChipsProps {
  selection: Selection;
  /** Rendered when nothing is filtered. */
  empty?: string;
  className?: string;
}

export function FilterChips({ selection, empty, className }: FilterChipsProps) {
  const clauses = useClauses(selection);

  if (clauses.length === 0) {
    return empty ? <p className="text-muted-foreground text-xs">{empty}</p> : null;
  }

  return (
    <div className={className}>
      {clauses.map((clause, i) => (
        <Badge className="gap-1 ps-2 pe-1" key={i} size="sm" variant="secondary">
          {clauseLabel(clause)}
          <button
            aria-label={`Remove ${clauseLabel(clause)}`}
            className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
            onClick={() => dropClause(selection, clause)}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
