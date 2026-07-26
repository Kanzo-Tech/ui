"use client";

import { createListCollection } from "@ark-ui/react/collection";
import { ListFilterIcon } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Listbox,
  ListboxContent,
  ListboxEmpty,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
} from "./listbox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";

export interface FacetFilterItem {
  value: string;
  label?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Rows behind this value, drawn at the row's end. */
  count?: number;
}

export interface FacetFilterProps
  extends Omit<React.ComponentProps<typeof Button>, "children" | "onSelect"> {
  /** Trigger label. */
  label?: React.ReactNode;
  /** The values on offer. */
  items: readonly FacetFilterItem[];
  /** The values currently filtered on. */
  value: readonly string[];
  onValueChange: (next: string[]) => void;
  /** Tick any number of values. `false` keeps at most one ticked. */
  multiple?: boolean;
  /** Shown when there is nothing to offer. */
  empty?: React.ReactNode;
  /** A footnote under the list — a truncation notice, a hint. */
  note?: React.ReactNode;
  /** Class for the popover surface; `className` styles the trigger. */
  contentClassName?: string;
}

/**
 * The surface behind every facet filter: a trigger that reports its own count, a listbox of
 * values, and a way out.
 *
 * A filter is **a value**, not a command, so this is a listbox and not a menu of checkbox items —
 * see DESIGN.md, "A menu is a command; a listbox is a value". Where the values come from and
 * where the choice goes are the caller's: TanStack facets on one side of this library, a Mosaic
 * clause on the other. What is *not* the caller's are the two rules below, which both adapters
 * had independently rediscovered, and which are invisible until they bite.
 */
export const FacetFilter = (props: FacetFilterProps) => {
  const {
    label,
    items,
    value,
    onValueChange,
    multiple = true,
    empty = "No values.",
    note,
    className,
    contentClassName,
    size = "sm",
    variant = "outline",
    ...rest
  } = props;

  const entries = useMemo(() => {
    const listed = new Map(items.map((item) => [item.value, item]));
    // A ticked value that another filter has since faceted away stays listed — otherwise it sits
    // in the filter with nothing to untick, and the only way out is a reload.
    for (const chosen of value) {
      if (!listed.has(chosen)) listed.set(chosen, { value: chosen });
    }
    // Sorted by label, never by count: ordering by frequency reshuffles the list under the cursor
    // every time another filter moves, so you tick the row that took the place of the one you read.
    return [...listed.values()].sort((a, b) =>
      facetLabel(a).localeCompare(facetLabel(b))
    );
  }, [items, value]);

  const collection = useMemo(
    () =>
      createListCollection({
        items: entries,
        itemToValue: (item) => item.value,
        itemToString: facetLabel,
      }),
    [entries]
  );

  const chosen = [...value];

  return (
    // Not modal, unlike our `Popover` default. A filter is judged by what changes behind it, and a
    // modal popover marks the rest of the page `aria-hidden` — so the table you are filtering
    // becomes unreadable to a screen reader at the exact moment it is being filtered.
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button
          className={className}
          data-slot="facet-filter"
          size={size}
          variant={variant}
          {...rest}
        >
          <ListFilterIcon />
          {label}
          {chosen.length > 0 && (
            <Badge size="xs" variant="secondary">
              {chosen.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn("w-56 p-1", contentClassName)}
        data-slot="facet-filter-content"
      >
        {/* No `deselectable`, deliberately. Zag's listbox binds Escape to VALUE.CLEAR when it is
            set, and calls `stopPropagation()` doing so — which wipes the filter *and* swallows the
            key the popover needed to dismiss. Escape must close a popover; it must not silently
            discard what you filtered. Leaving it off also matches `Select`, where clicking the
            chosen option does not unchoose it either: clearing is what the clear affordance below
            is for. See the pinned tests in `listbox.test.tsx`. */}
        <Listbox
          collection={collection}
          onValueChange={(details) => onValueChange(details.value)}
          selectionMode={multiple ? "multiple" : "single"}
          value={chosen}
        >
          <ListboxContent className="max-h-72 overflow-y-auto">
            {entries.map((item) => {
              const Icon = item.icon;

              return (
                <ListboxItem item={item} key={item.value}>
                  {Icon && <Icon />}
                  <ListboxItemText>{item.label ?? item.value}</ListboxItemText>
                  {item.count !== undefined && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.count}
                    </span>
                  )}
                  <ListboxItemIndicator />
                </ListboxItem>
              );
            })}

            <ListboxEmpty>{empty}</ListboxEmpty>
          </ListboxContent>
        </Listbox>

        {note && (
          <p
            className="px-2 py-1.5 text-muted-foreground text-xs"
            data-slot="facet-filter-note"
          >
            {note}
          </p>
        )}

        {/* Clearing is a command, so it is a button and not a row of the listbox — putting it in
            the list would make "clear" look like one more value you can filter on. */}
        {chosen.length > 0 && (
          <>
            <Separator className="my-1" />
            <Button
              className="w-full justify-center"
              data-slot="facet-filter-clear"
              onClick={() => onValueChange([])}
              size="sm"
              variant="ghost"
            >
              Clear filter
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

const facetLabel = (item: FacetFilterItem) =>
  typeof item.label === "string" ? item.label : item.value;
