"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

export interface FieldArrayProps {
  /** Rows to render. The consumer owns the count — it may include not-yet-committed rows. */
  count: number;
  /**
   * Stable key for row `index`.
   *
   * NOT optional, and never the bare index. A row that is only a UI placeholder must
   * already carry the key it will have once committed; if the key changes on commit,
   * React remounts the input and the user loses focus and caret mid-typing.
   */
  rowKey: (index: number) => string;
  children: (index: number) => ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Hide "Add" — e.g. a maximum was reached, or the field is read-only. Default true. */
  canAdd?: boolean;
  /** Hide every remove control. Default true. */
  canRemove?: boolean;
  addLabel?: ReactNode;
  /** Accessible name for each row's remove control. Default "Remove". */
  removeLabel?: string;
  /**
   * Row cross-axis alignment. "center" suits single-line controls; "start" suits rows
   * whose content is a block (a nested form, a textarea).
   */
  align?: "center" | "start";
  className?: string;
}

/**
 * The repeatable-rows layout: N rows, a remove control per row, and an add control below.
 *
 * Deliberately stateless and unaware of cardinality — it renders exactly `count` rows and
 * reports intent. Whoever owns the data decides what "add" means and whether another row
 * is allowed, which is what lets the same component sit on top of a form library, a plain
 * array, or a graph.
 */
export function FieldArray({
  count,
  rowKey,
  children,
  onAdd,
  onRemove,
  canAdd = true,
  canRemove = true,
  addLabel = "Add",
  removeLabel = "Remove",
  align = "center",
  className,
}: FieldArrayProps) {
  const rows = [];
  for (let index = 0; index < count; index++) {
    rows.push(
      <div
        className={cn(
          "flex gap-2",
          align === "center" ? "items-center" : "items-start"
        )}
        data-slot="field-array-row"
        key={rowKey(index)}
      >
        <div className="min-w-0 flex-1">{children(index)}</div>
        {canRemove && (
          <Button
            aria-label={removeLabel}
            className={align === "start" ? "mt-0.5" : undefined}
            onClick={() => onRemove(index)}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="field-array"
    >
      {rows}
      {canAdd && (
        <Button
          className="self-start"
          onClick={onAdd}
          size="sm"
          variant="secondary"
        >
          <PlusIcon />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
FieldArray.displayName = "FieldArray";
