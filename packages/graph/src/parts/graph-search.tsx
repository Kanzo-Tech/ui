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
} from "@kanzo-tech/ui";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { searchTitles } from "../core/source";
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

/** What one query answered, or `false` when the read failed. */
type Found = { query: string; entries: Entry[] | false } | null;

/** How long a reader pauses before the text is asked for: one statement per pause, not per key. */
const PAUSE = 150;

/**
 * **Find a vertex by its text and go to it** — Cosmograph's search: each pause in typing asks the
 * corpus for the first `limit` vertices whose `title` — or its table's `identity` — contains the text,
 * case-insensitively, one `ILIKE` over every vertex table through the page's coordinator. Nothing is
 * read before the reader types, and no vertex's text is held in the page. Each match is named by the
 * root's `categories`; picking one is `reveal`: the canvas frames it and selects it with its
 * neighbours, and `GraphInspector` reads it.
 *
 * A read that fails is handed to `onFailure` whole and the input says so.
 */
export function GraphSearch({ className, limit = 50, placeholder = "Find a node…", size = "sm" }: GraphSearchProps) {
  const api = useGraphContext();
  const structure = useGraphState((s) => s.structure);
  const options = useGraphState((s) => s.options);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const [found, setFound] = useState<Found>(null);
  const [query, setQuery] = useState("");
  const { title, categories, coordinator } = options;
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;

  useEffect(() => {
    if (!structure || !coordinator || query === "") return;
    let current = true;
    const timer = setTimeout(() => {
      searchTitles(coordinator, structure, query, title, limit).then(
        (rows) =>
          current &&
          setFound({
            query,
            entries: rows.map(({ id, text }) => ({
              value: String(id),
              label: text || `#${id}`,
              kind: bound && encoding ? nameOf(domain[encoding.ranks[id] as number], categories) : null,
            })),
          }),
        (error: unknown) => {
          if (!current) return;
          setFound({ query, entries: false });
          api.getState().options.onFailure(error);
        },
      );
    }, PAUSE);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, structure, coordinator, query, title, limit, bound, encoding, domain, categories]);

  const answered = found && found.query === query ? found.entries : null;
  const collection = useMemo(() => createListCollection({ items: answered || [] }), [answered]);

  return (
    <Combobox
      collection={collection}
      disabled={structure === null}
      onInputValueChange={(details) => setQuery(details.inputValue)}
      onValueChange={(details) => {
        const picked = details.value[0];
        if (picked !== undefined) api.reveal(Number(picked));
      }}
    >
      <ComboboxInput
        aria-invalid={answered === false || undefined}
        className={className}
        placeholder={answered === false ? "The names could not be read." : placeholder}
        size={size}
      >
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>Nothing by that name.</ComboboxEmpty>
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
