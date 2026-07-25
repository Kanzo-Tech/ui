import type { HeaderContext } from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";

const sortableHeaderVariants = tv({
  base: "inline-flex h-7 items-center gap-1 rounded-md px-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
  variants: {
    align: {
      start: "-ms-1",
      // `w-full` is what makes the header hug the column's trailing edge: the cell is as wide
      // as the column, the button is not, so without it `justify-end` has nothing to push against.
      end: "-me-1 w-full justify-end",
    },
  },
  defaultVariants: { align: "start" },
});

export interface SortableHeaderOptions {
  /**
   * Which edge the header hugs. Use `end` over end-aligned figures (`tabular-nums` money,
   * counts) so the label sits above the digits. Logical: mirrors under RTL.
   *
   * @default "start"
   */
  align?: "start" | "end";
}

function SortGlyph({ dir }: { dir: false | "asc" | "desc" }) {
  const cls = "size-3.5 shrink-0";
  if (dir === "asc") return <ChevronUpIcon className={cn(cls, "text-foreground")} />;
  if (dir === "desc") return <ChevronDownIcon className={cn(cls, "text-foreground")} />;
  return <ChevronsUpDownIcon className={cn(cls, "opacity-50")} />;
}

/**
 * A sortable column header: a button that toggles the column's sort and shows the
 * direction glyph.
 *
 * Sorting is opt-in PER COLUMN by using this helper for the header — a plain-string header
 * stays inert even though TanStack marks every column sortable by default. This mirrors the
 * 4 keasy call sites (`header: sortableHeader("Name")`) exactly, so adopting the DS table
 * needs zero column-definition churn.
 *
 * `sortableHeader("Runs", { align: "end" })` puts it over an end-aligned numeric column without
 * a wrapper; the cell's own alignment stays the caller's business.
 */
export function sortableHeader<TData, TValue>(
  label: ReactNode,
  { align = "start" }: SortableHeaderOptions = {},
) {
  return function SortableHeader({ column }: HeaderContext<TData, TValue>) {
    return (
      <button
        className={cn(sortableHeaderVariants({ align }))}
        data-align={align}
        data-slot="sortable-header"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        type="button"
      >
        {label}
        <SortGlyph dir={column.getIsSorted()} />
      </button>
    );
  };
}
