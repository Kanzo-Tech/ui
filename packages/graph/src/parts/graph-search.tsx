"use client";

import {
  Button,
  Command,
  CommandContent,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  createListCollection,
  Highlight,
  Show,
  useChartCapacity,
} from "@kanzo-tech/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { matchingIds, parseQuery, searchVertices, tableOf, type Found, type VertexQuery } from "../core/source";
import { internalsOf } from "../react/use-graph";
import { useGraphContext } from "../react/graph-root";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export interface GraphSearchProps extends Pick<React.ComponentProps<typeof CommandInput>, "placeholder" | "size"> {
  /** On the palette's box. */
  className?: string;
  /** How many matches the list shows; past it, the list says to keep typing. */
  limit?: number;
}

interface Entry {
  value: string;
  vertex: number;
  label: string;
  /** Its vertex table, or {@link RECENT} for a vertex the search went to before. */
  group: string;
}

/** What one input answered, or `false` when the read failed. */
type Answered = { input: string; query: VertexQuery; found: Found | false } | null;

/** How long a reader pauses before the text is asked for: one statement per pause, not per key. */
const PAUSE = 150;
const RECENT = "\0recent";

/**
 * Every mounted search, the one the reader used or pointed into last at the end — the one ⌘K moves
 * to. Two graphs on one page would otherwise both take the key, and the later listener would win.
 */
const claims: object[] = [];
const claim = (token: object) => {
  const at = claims.indexOf(token);
  if (at >= 0) claims.splice(at, 1);
  claims.push(token);
};

/**
 * **Find a vertex and go to it** — a palette in Raycast's and Linear's shape over Cosmograph's search,
 * with Neo4j Bloom's prefixes: `type:<Type>` keeps a vertex table, `<column>:<value>` a column that
 * contains the value, and the rest is text the vertex's `title` — or its table's `identity` — must
 * contain. Each pause in typing asks the corpus once, through the page's coordinator, for the first
 * `limit` matches and how many there are of each type; nothing is read before the reader types, and
 * no vertex's text is held in the page.
 *
 * Matches are grouped by vertex type, named by the root's `categories` and counted past the limit,
 * each with the glyph the canvas draws it in. Picking one is `reveal` — the canvas frames it and
 * selects it with its neighbours — and puts it at the head of the recents the empty palette shows,
 * kept by the root while it lives. "Select N matches" selects every match as an `"external"`
 * selection. ⌘K or Ctrl+K moves to the search of the graph the reader last used.
 *
 * A read that fails is handed to `onFailure` whole and the input says so.
 *
 * ARIA: Ark's combobox — a `combobox` input over a `listbox` of `option`s in labelled groups; the
 * shortcut is declared on the input as `aria-keyshortcuts`.
 */
export function GraphSearch({ className, limit = 50, placeholder = "Find a node…", size = "sm" }: GraphSearchProps) {
  const api = useGraphContext();
  const structure = useGraphState((s) => s.structure);
  const options = useGraphState((s) => s.options);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const recent = useGraphSnapshot((s) => s.recent);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const [answered, setAnswered] = useState<Answered>(null);
  const [input, setInput] = useState("");
  const [token] = useState(() => ({}));
  const root = useRef<HTMLDivElement>(null);
  const { title, categories, coordinator } = options;
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;

  useEffect(() => {
    if (!structure || !coordinator || input.trim() === "") return;
    let current = true;
    const query = parseQuery(input, structure);
    const timer = setTimeout(() => {
      searchVertices(coordinator, structure, { query, title, limit }).then(
        (found) => current && setAnswered({ input, query, found }),
        (error: unknown) => {
          if (!current) return;
          setAnswered({ input, query, found: false });
          api.getState().options.onFailure(error);
        },
      );
    }, PAUSE);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, structure, coordinator, input, title, limit]);

  useEffect(() => {
    claim(token);
    let last = api.getState();
    const unsubscribe = api.subscribe(() => {
      const now = api.getState();
      const touched = (["hovered", "focus", "selection"] as const).some((key) => now[key] !== last[key] && now[key] !== null);
      last = now;
      if (touched) claim(token);
    });
    const onKey = (event: KeyboardEvent) => {
      if (claims.at(-1) !== token || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      root.current?.querySelector("input")?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      claims.splice(claims.indexOf(token), 1);
      unsubscribe();
      document.removeEventListener("keydown", onKey);
    };
  }, [api, token]);

  const typed = input.trim() !== "";
  const result = answered !== null && answered.input === input ? answered : null;
  const found = typed ? (result?.found ?? null) : null;
  const items = useMemo<Entry[]>(() => {
    if (typed) return found ? found.matches.map((m) => ({ value: String(m.id), vertex: m.id, label: m.text || `#${m.id}`, group: m.type })) : [];
    return recent.map((r) => ({ value: String(r.vertex), vertex: r.vertex, label: r.text, group: RECENT }));
  }, [typed, found, recent]);
  const collection = useMemo(() => createListCollection({ items, groupBy: (item) => item.group }), [items]);
  const terms = result ? [result.query.text, ...result.query.fields.map((f) => f.value)].filter((t) => t !== "") : [];

  const glyph = (vertex: number) => {
    const rank = encoding?.ranks[vertex];
    if (!bound || rank === undefined) return null;
    return <ShapeGlyph aria-hidden className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />;
  };
  const heading = (group: string) => {
    if (group === RECENT) return "Recent";
    const n = found ? found.byType.get(group) : undefined;
    return (
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate">{nameOf(group, categories)}</span>
        <span className="font-normal tabular-nums">{n?.toLocaleString()}</span>
      </span>
    );
  };
  const selectAll = async () => {
    if (!structure || !coordinator || !result) return;
    try {
      api.select(await matchingIds(coordinator, structure, result.query, title), "external", `Matches for “${result.input.trim()}”`);
    } catch (error) {
      api.getState().options.onFailure(error);
    }
  };

  return (
    <Command
      className={className}
      collection={collection}
      disabled={structure === null}
      onFocus={() => claim(token)}
      onInputValueChange={(details) => setInput(details.inputValue)}
      onValueChange={(details) => {
        const picked = items.find((item) => item.value === details.value[0]);
        if (!picked) return;
        internalsOf(api).store.remember(picked.vertex, picked.label);
        api.reveal(picked.vertex);
      }}
      ref={root}
    >
      <CommandInput
        aria-invalid={found === false || undefined}
        aria-keyshortcuts="Meta+K Control+K"
        autoFocus={false}
        placeholder={found === false ? "The names could not be read." : placeholder}
        size={size}
      />
      <Show when={typed || items.length > 0}>
        <CommandContent>
          <Show when={found !== null}>
            <CommandEmpty>Nothing by that name.</CommandEmpty>
          </Show>
          <CommandList>
            {collection.group().map(([group, entries]) => (
              <CommandGroup heading={heading(group)} key={group}>
                {entries.map((item) => (
                  <CommandItem item={item} key={item.value}>
                    {glyph(item.vertex)}
                    <span className="min-w-0 truncate">
                      <Highlight ignoreCase matchAll query={terms} text={item.label} />
                    </span>
                    <Show when={group === RECENT && !!structure}>
                      <span className="ms-auto ps-2 text-muted-foreground text-xs">
                        {structure && nameOf(tableOf(structure, item.vertex)?.name, categories)}
                      </span>
                    </Show>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <Show when={!!found && found.total > limit}>
            <p className="border-t px-2 py-1.5 text-muted-foreground text-xs">First {limit}. Keep typing to narrow it.</p>
          </Show>
        </CommandContent>
        <Show when={!!found && found.total > 0}>
          <CommandFooter>
            <Button onClick={() => void selectAll()} size="sm" variant="ghost">
              Select {found ? found.total.toLocaleString() : 0} matches
            </Button>
          </CommandFooter>
        </Show>
      </Show>
    </Command>
  );
}
