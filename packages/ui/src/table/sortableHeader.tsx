import type { HeaderContext } from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

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
 */
export function sortableHeader<TData, TValue>(label: ReactNode) {
  return function SortableHeader({ column }: HeaderContext<TData, TValue>) {
    return (
      <button
        className="-ms-1 inline-flex h-7 items-center gap-1 rounded-md px-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        type="button"
      >
        {label}
        <SortGlyph dir={column.getIsSorted()} />
      </button>
    );
  };
}
