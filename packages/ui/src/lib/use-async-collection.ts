"use client";

import {
  type CollectionItem,
  createListCollection,
  type ListCollection,
  useAsyncList,
} from "@ark-ui/react/collection";
import { useEffect, useMemo, useRef, useState } from "react";

export interface AsyncCollectionOptions<T extends CollectionItem> {
  /**
   * Candidates for `query`. Called with an empty query on mount, so a list can be offered before
   * anything is typed. `signal` aborts when a newer query starts; pass it to `fetch`.
   */
  load: (query: string, signal: AbortSignal | undefined) => Promise<T[]>;
  /** @default `item.value` */
  itemToValue?: (item: T) => string;
  /** @default `item.label` */
  itemToString?: (item: T) => string;
  /**
   * How long typing must pause before `load` runs, in milliseconds.
   *
   * @default 250
   */
  debounce?: number;
  initialItems?: T[];
}

export interface AsyncCollection<T extends CollectionItem> {
  /** What to hand a `Combobox`, `Select` or `Listbox`. Rebuilt when a load lands. */
  collection: ListCollection<T>;
  /** Wire this to `onInputValueChange`: `(d) => setQuery(d.inputValue)`. */
  setQuery: (query: string) => void;
  /** A request is in flight. The previous items stay in `collection` until it lands. */
  loading: boolean;
  /** The last request landed and offered nothing. False while loading. */
  empty: boolean;
  /** The last request failed. The previous items stay in `collection`. */
  error: unknown;
  reload: () => void;
  /**
   * The label of a value this hook has ever offered, and `undefined` for one it has not.
   *
   * It is not a cache: a selected value's label exists only in the batch that offered it, and
   * the next keystroke replaces the batch, so without it a chosen item reads as its raw value
   * again the moment the user types.
   */
  labelOf: (value: string) => string | undefined;
}

/**
 * Items fetched as the user types: a debounced query, a request that aborts when a newer one
 * starts, and the loading, empty and error states of the last one.
 *
 * The machine is Ark's `useAsyncList`; this adds the pause before it runs, the collection a
 * `Combobox` wants, and `labelOf`. Filtering is the server's — the `Combobox` machine never mutates
 * the collection it is given.
 *
 * @example
 * const { collection, setQuery, loading } = useAsyncCollection({ load });
 * <Combobox collection={collection} onInputValueChange={(d) => setQuery(d.inputValue)}>
 */
export function useAsyncCollection<T extends CollectionItem = { label: string; value: string }>(
  options: AsyncCollectionOptions<T>
): AsyncCollection<T> {
  const { debounce = 250, initialItems, itemToString, itemToValue, load } = options;

  // `load` is usually an inline closure, and Ark reads it when the request starts rather than when
  // the machine is created; the ref is what keeps a caller from having to memoise it.
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());

  const list = useAsyncList<T, never>({
    autoReload: true,
    initialItems,
    load: async ({ filterText, signal }) => ({ items: await latest.current(filterText, signal) }),
    onSuccess: ({ items }) =>
      setLabels((known) => {
        const next = new Map(known);
        for (const item of items) {
          next.set(
            itemToValue ? itemToValue(item) : String((item as { value: unknown }).value),
            itemToString ? itemToString(item) : String((item as { label: unknown }).label)
          );
        }
        return next;
      }),
  });

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const { setFilterText } = list;
  const setQuery = (query: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilterText(query), debounce);
  };

  const collection = useMemo(
    () => createListCollection<T>({ items: list.items, itemToValue, itemToString }),
    [list.items, itemToValue, itemToString]
  );

  return {
    collection,
    setQuery,
    loading: list.loading,
    empty: !list.loading && list.items.length === 0,
    error: list.error,
    reload: list.reload,
    labelOf: (value) => labels.get(value),
  };
}
