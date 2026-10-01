"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  createListCollection,
  InputGroupAddon,
  Show,
  useFilter,
} from "@kanzo-tech/ui";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { readEveryTitle } from "../core/detail";
import type { Encoding, Geometry } from "../core/load";
import { useGraphContext } from "../react/graph-root";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";

export interface GraphSearchProps extends Pick<React.ComponentProps<typeof ComboboxInput>, "className" | "placeholder" | "size"> {
  /** How many matches the list shows; past it, the list says to keep typing. */
  limit?: number;
}

interface Entry {
  value: string;
  label: string;
  kind: string | null;
}

type Titles = { geometry: Geometry; title: string | undefined; titles: string[] } | null;

/** Every drawn vertex, biggest on the `r` ramp first — the vertices a reader most likely means. */
function entriesOf(
  geometry: Geometry,
  encoding: Encoding,
  mask: Uint8Array | null,
  titles: readonly string[],
  kindOf: ((rank: number) => string) | null,
): Entry[] {
  const ids: number[] = [];
  for (let id = 0; id < geometry.size; id++) {
    if ((!mask || mask[id]) && !Number.isNaN(geometry.positions[id * 2])) ids.push(id);
  }
  const { sizes } = encoding;
  if (sizes) {
    const ramp = (id: number) => (Number.isNaN(sizes[id]) ? -Infinity : (sizes[id] as number));
    ids.sort((a, b) => ramp(b) - ramp(a) || a - b);
  }
  return ids.map((id) => ({
    value: String(id),
    label: titles[id] || `#${id}`,
    kind: kindOf ? kindOf(encoding.ranks[id] as number) : null,
  }));
}

/**
 * **Find a vertex by its text and go to it.** Every drawn vertex's `title` — or its table's
 * `identity` — is read once, then filtered in the browser as the reader types: no query per
 * keystroke. The list is ordered by the `r` ramp, so with `r="degree"` the hubs come first, and each
 * match is named by the root's `categories`. Picking one is `reveal`: the canvas frames it and
 * selects it with its neighbours, and `GraphInspector` reads it.
 *
 * A vertex the page's filter hides is not offered, because there is nothing on the canvas to go to.
 */
export function GraphSearch({ className, limit = 50, placeholder = "Find a node…", size = "sm" }: GraphSearchProps) {
  const api = useGraphContext();
  const corpus = useGraphState((s) => s.corpus);
  const options = useGraphState((s) => s.options);
  const geometry = useGraphSnapshot((s) => s.geometry);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const mask = useGraphSnapshot((s) => s.mask);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const [read, setRead] = useState<Titles>(null);
  const [query, setQuery] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const { title, categories } = options;

  useEffect(() => {
    if (!corpus || !geometry) return;
    const aborter = new AbortController();
    readEveryTitle(corpus, geometry, title, aborter.signal).then(
      (titles) => !aborter.signal.aborted && setRead({ geometry, title, titles }),
      (error: unknown) => {
        if (aborter.signal.aborted) return;
        api.getState().options.onFailure(error instanceof Error ? error.message : String(error));
      },
    );
    return () => aborter.abort();
  }, [api, corpus, geometry, title]);

  const titles = read && read.geometry === geometry && read.title === title ? read.titles : null;
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;

  const entries = useMemo(() => {
    if (!geometry || !encoding || !titles) return null;
    return entriesOf(geometry, encoding, mask, titles, bound ? (rank) => nameOf(domain[rank], categories) : null);
  }, [geometry, encoding, mask, titles, bound, domain, categories]);

  const collection = useMemo(() => {
    const matches: Entry[] = [];
    for (const entry of entries ?? []) {
      if (matches.length === limit) break;
      if (!query || contains(entry.label, query)) matches.push(entry);
    }
    return createListCollection({ items: matches });
  }, [entries, query, contains, limit]);

  return (
    <Combobox
      collection={collection}
      disabled={entries === null}
      onInputValueChange={(details) => setQuery(details.inputValue)}
      onValueChange={(details) => {
        const picked = details.value[0];
        if (picked !== undefined) api.reveal(Number(picked));
      }}
    >
      <ComboboxInput className={className} placeholder={placeholder} size={size}>
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>Nothing drawn by that name.</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.value}>
            <span className="min-w-0 truncate">{item.label}</span>
            <Show when={item.kind !== null}>
              <span className="ms-auto ps-2 text-muted-foreground text-xs">{item.kind}</span>
            </Show>
          </ComboboxItem>
        ))}
        <Show when={collection.items.length === limit}>
          <p className="border-t px-2 py-1.5 text-muted-foreground text-xs">First {limit}. Keep typing to narrow it.</p>
        </Show>
      </ComboboxContent>
    </Combobox>
  );
}
