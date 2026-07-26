"use client";

import { createListCollection } from "@ark-ui/react/collection";
import { useFilter } from "@ark-ui/react/locale";
import { ListFilterIcon } from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Listbox,
  ListboxContent,
  ListboxEmpty,
  ListboxInput,
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
  /**
   * Draw a filter field above the list, narrowing the rows on offer.
   *
   * Deliberately a prop and never a count threshold: the caller knows whether the column is
   * `provider` or `subject_uri`, and a control that grows a search field once the crossfilter
   * pushes it past *n* values reshapes itself under the cursor.
   *
   * @default false
   */
  searchable?: boolean;
  /** Placeholder for the `searchable` field. */
  searchPlaceholder?: string;
  /** Accessible name for the `searchable` field. */
  searchLabel?: string;
  /** Shown when the `searchable` query excludes every row. Not the same state as `empty`. */
  searchEmpty?: React.ReactNode;
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
 * had independently rediscovered, and which are invisible until they bite — and which both have to
 * survive `searchable`, because a query that hides a ticked row takes the untick with it.
 */
export const FacetFilter = (props: FacetFilterProps) => {
  const {
    label,
    items,
    value,
    onValueChange,
    multiple = true,
    searchable = false,
    searchPlaceholder = "Filter values…",
    searchLabel = "Filter values",
    searchEmpty = "No matching values.",
    empty = "No values.",
    note,
    className,
    contentClassName,
    size = "sm",
    variant = "outline",
    ...rest
  } = props;

  const [query, setQuery] = useState("");
  const fieldRef = useRef<HTMLInputElement>(null);
  // Locale-aware, "base" sensitivity: case and accents do not block a match, which is what a
  // user typing `coruna` at a list containing `A Coruña` expects. Same call `Combobox` makes.
  //
  // The options object is hoisted, not inlined, because `useFilter` memoises on it by identity —
  // an inline literal hands back a fresh `contains` every render, which rebuilds the collection
  // every render, which makes the listbox re-sync its highlight in a microtask while you are still
  // typing. The visible symptom is dropped keystrokes, and it points nowhere near here.
  const { contains } = useFilter(FILTER_SENSITIVITY);

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

  const trimmed = searchable ? query.trim() : "";

  const visible = useMemo(() => {
    if (!trimmed) return entries;
    const ticked = new Set(value);
    // A ticked value is never hidden by the query: unticking it is the only way back out, and a
    // filter you cannot undo from the surface that set it needs a reload.
    return entries.filter(
      (item) => ticked.has(item.value) || contains(facetLabel(item), trimmed)
    );
  }, [contains, entries, trimmed, value]);

  // Built from what is drawn, not from what was offered: Ark navigates the collection, so an item
  // filtered out of the DOM but left in here is a row the arrow keys highlight and nobody can see.
  const collection = useMemo(
    () =>
      createListCollection({
        items: visible,
        itemToValue: (item) => item.value,
        itemToString: facetLabel,
      }),
    [visible]
  );

  const chosen = [...value];
  // Two empty states, and they are not the same news. `empty` means the facet offers nothing —
  // still loading, or a column with no values under the current crossfilter. `searchEmpty` means
  // your query excluded everything the facet did offer, which clears itself when you retype.
  const queryExcludedAll = visible.length === 0 && entries.length > 0;

  return (
    // Not modal, unlike our `Popover` default. A filter is judged by what changes behind it, and a
    // modal popover marks the rest of the page `aria-hidden` — so the table you are filtering
    // becomes unreadable to a screen reader at the exact moment it is being filtered.
    //
    // The query resets with the surface, because `Popover` unmounts its content on exit: the
    // input's DOM value goes with it while this state would not, leaving a reopened filter showing
    // every row from a query it still believes in.
    //
    // `initialFocusEl` aims the popover's opening focus at the field when there is one. Zag's
    // default lands on the content itself, and it lands *late* — so a first keystroke typed
    // straight after opening goes to the list as typeahead, and the focus then moves out from
    // under the caret. Pointing it at the field makes "open it and start typing" work, which is
    // the only reason a filter field is there.
    <Popover
      initialFocusEl={searchable ? () => fieldRef.current : undefined}
      modal={false}
      onOpenChange={() => setQuery("")}
    >
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
          {searchable && (
            // `autoHighlight` is Ark's, off by default and worth turning on here: it re-highlights
            // the first row of the collection every time the collection changes, so typing leaves
            // the top match under Enter instead of requiring an ArrowDown first. `keyboardPriority`
            // stays "caret" — Home/End belong to the text you are editing.
            <ListboxInput
              aria-label={searchLabel}
              autoHighlight
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              ref={fieldRef}
              size="sm"
              value={query}
            />
          )}

          <ListboxContent className="max-h-72 overflow-y-auto">
            {visible.map((item) => {
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

            <ListboxEmpty>{queryExcludedAll ? searchEmpty : empty}</ListboxEmpty>
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

const FILTER_SENSITIVITY = { sensitivity: "base" } as const;

const facetLabel = (item: FacetFilterItem) =>
  typeof item.label === "string" ? item.label : item.value;
