"use client";

import {
  Button,
  Command,
  CommandContent,
  CommandDialog,
  CommandDialogContent,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  createListCollection,
  DialogTrigger,
  Highlight,
  Kbd,
  KbdGroup,
  Show,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemPreview,
  TagsInputItemText,
  TagsInputRootProvider,
  useChartCapacity,
  useTagsInput,
} from "@kanzo-tech/ui";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { matchingIds, parseQuery, searchVertices, type Found, type VertexQuery } from "../core/source";
import { localName, tableOf } from "../core/structure";
import { internalsOf } from "../react/use-graph";
import { useGraphContext } from "../react/graph-root";
import { usePick } from "../react/use-pick";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export interface GraphSearchProps {
  /** On the cue in the page: what it says, and what the palette's empty input says. */
  placeholder?: string;
  /** The cue's size. */
  size?: "sm" | "md" | "lg";
  /** On the cue. */
  className?: string;
  /** How many matches the list shows; past it, the list says to keep typing. */
  limit?: number;
}

interface Entry {
  value: string;
  /** The vertex it goes to, or `null` for a type the empty palette offers as a chip. */
  vertex: number | null;
  label: string;
  /** What tells it apart from a match of the same name: its identity's local name, or its type. */
  detail: string;
  /** Its vertex table, {@link RECENT} for a vertex the search went to before, or {@link TYPES}. */
  group: string;
}

/** What one query answered, or `false` when the read failed. */
type Answered = { input: string; query: VertexQuery; found: Found | false } | null;

/** How long a reader pauses before the text is asked for: one statement per pause, not per key. */
const PAUSE = 150;
const RECENT = "\0recent";
const TYPES = "\0types";

/**
 * **Find a vertex and go to it** — a palette in Raycast's and Linear's shape over Cosmograph's search,
 * with Neo4j Bloom's prefixes: `type:<Type>` keeps a vertex table, `<column>:<value>` a column that
 * contains the value, and the rest is text the vertex's `title` — or its table's `identity` — must
 * contain. Each pause in typing asks the corpus once, through the page's coordinator, for the first
 * `limit` matches and how many there are of each type; nothing is read before the reader types, and
 * no vertex's text is held in the page.
 *
 * In the page it is a cue: a button that looks like a field and prints ⌘K, holding no state — Shark's
 * own command trigger. It and ⌘K or Ctrl+K open the palette, centred and full-height over the canvas
 * (`CommandDialog`'s `hotkey`); one palette per page, so nothing arbitrates the key. A prefix word
 * becomes a chip on Space — a `TagsInput` sharing the palette's input, its `validate` the same
 * `parseQuery` the read uses, so free text never becomes one.
 *
 * The palette keeps its height whatever it holds, as Raycast's and Linear's do. Empty, it offers what
 * to start from: the vertices the search went to before, kept by the root while it lives, then every
 * vertex type with how many it holds — picking one makes it a `type:` chip, GitHub's palette scopes.
 * Typed, matches are grouped by vertex type, named by the root's `categories` and counted past the
 * limit, each with the glyph the canvas draws it in and, on the right, its identity's local name, as
 * Linear prints an issue's key — a title is not unique, and the key is what tells two apart. **Enter**
 * reveals the highlighted one — the canvas frames it and selects it with its neighbours — closes the
 * palette and puts it at the head of the recents. **⌘Enter** adds every match to the subset: the
 * search's own clause (`usePick("search")`), which a new search replaces and every other pick
 * intersects. **It searches the subset** — every clause on the page but its own — and the footer
 * says how many matched, how many of them the list shows, and how many more the subset leaves out.
 *
 * A read that fails is handed to `onFailure` whole and the input says so.
 *
 * ARIA: a `button` declaring `aria-keyshortcuts`, opening a `dialog` that holds Ark's combobox — a
 * `combobox` input over a `listbox` of `option`s in labelled groups.
 */
export function GraphSearch({ className, limit = 50, placeholder = "Find a node…", size = "sm" }: GraphSearchProps) {
  const api = useGraphContext();
  const search = usePick("search");
  const { predicate } = search;
  const structure = useGraphState((s) => s.structure);
  const options = useGraphState((s) => s.options);
  const encoding = useGraphSnapshot((s) => s.encoding);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const recent = useGraphSnapshot((s) => s.recent);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const [answered, setAnswered] = useState<Answered>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const id = useId();
  const { title, categories, coordinator } = options;
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;

  // One input, two machines: the chips' props go first, so the palette's own id and value win and
  // both hear every key — Shark's `tags-input/example-combobox`, through `CommandInput`'s children.
  const chips = useTagsInput({
    ids: { input: id },
    delimiter: " ",
    editable: false,
    validate: ({ inputValue }) => {
      if (!structure) return false;
      const word = parseQuery(inputValue, structure);
      return word.text === "" && word.types.length + word.fields.length > 0;
    },
    onValueChange: () => setText(""),
  });
  const input = [...chips.value, text].join(" ").trim();

  useEffect(() => {
    if (!structure || !coordinator || input === "") return;
    let current = true;
    const query = parseQuery(input, structure);
    const timer = setTimeout(() => {
      searchVertices(coordinator, structure, { query, title, limit, subset: predicate() }).then(
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
  }, [api, predicate, structure, coordinator, input, title, limit]);

  const typed = input !== "";
  const result = answered !== null && answered.input === input ? answered : null;
  const found = typed ? (result?.found ?? null) : null;
  const items = useMemo<Entry[]>(() => {
    if (typed) {
      if (!found) return [];
      return found.matches.map((m) => {
        const label = m.text || `#${m.id}`;
        const key = localName(m.key);
        return { value: String(m.id), vertex: m.id, label, detail: key === label ? "" : key, group: m.type };
      });
    }
    const typeOf = (vertex: number) => (structure ? nameOf(tableOf(structure, vertex)?.name, categories) : "");
    return [
      ...recent.map((r) => ({ value: String(r.vertex), vertex: r.vertex, label: r.text, detail: typeOf(r.vertex), group: RECENT })),
      ...(structure?.vertices ?? []).map((t) => ({
        value: `type:${t.name}`,
        vertex: null,
        label: nameOf(t.name, categories),
        detail: t.rows.toLocaleString(),
        group: TYPES,
      })),
    ];
  }, [typed, found, recent, structure, categories]);
  const collection = useMemo(() => createListCollection({ items, groupBy: (item) => item.group }), [items]);
  const terms = result ? [result.query.text, ...result.query.fields.map((f) => f.value)].filter((t) => t !== "") : [];

  const glyph = (item: Entry) => {
    // A type wears the glyph its vertices do only when the type is what the canvas colours by.
    const typeRank = binding.byTable ? domain.findIndex((value) => `type:${String(value)}` === item.value) : -1;
    const rank = item.vertex === null ? (typeRank < 0 ? undefined : typeRank) : encoding?.ranks[item.vertex];
    if (!bound || rank === undefined) return null;
    return <ShapeGlyph aria-hidden className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />;
  };
  const heading = (group: string) => {
    if (group === RECENT) return "Recent";
    if (group === TYPES) return "Narrow to a type";
    const n = found ? found.byType.get(group) : undefined;
    return (
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate">{nameOf(group, categories)}</span>
        <span className="font-normal tabular-nums">{n?.toLocaleString()}</span>
      </span>
    );
  };
  const addAll = async () => {
    if (!structure || !coordinator || !result) return;
    try {
      search.pick(await matchingIds(coordinator, structure, result.query, { title, subset: predicate() }), `“${result.input}”`);
      setOpen(false);
    } catch (error) {
      api.getState().options.onFailure(error);
    }
  };

  // Typed as every attribute an `<input>` takes, `size` among them, which names the field's size
  // variant here; the machine sets no `size`, so the omission is the type catching up.
  const tagKeys: Omit<ReturnType<typeof chips.getInputProps>, "size"> = chips.getInputProps();

  return (
    <CommandDialog hotkey="mod+k" onOpenChange={(details) => setOpen(details.open)} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-keyshortcuts="Meta+K Control+K"
          className={cn("w-full justify-start font-normal text-muted-foreground", className)}
          disabled={structure === null}
          size={size}
          variant="outline"
        >
          <SearchIcon aria-hidden />
          <span className="min-w-0 truncate">{placeholder}</span>
          <KbdGroup className="ms-auto">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </DialogTrigger>
      <CommandDialogContent className="h-[min(40rem,calc(100dvh-4rem))]" description="Find a vertex by its name, its type or a column." title="Find a node">
        <TagsInputRootProvider className="min-h-0 flex-1" value={chips}>
          <Command
            collection={collection}
            ids={{ input: id }}
            inputValue={text}
            onInputValueChange={(details) => setText(details.inputValue)}
            onValueChange={(details) => {
              const picked = items.find((item) => item.value === details.value[0]);
              if (!picked) return;
              if (picked.vertex === null) {
                chips.addValue(picked.value);
                return;
              }
              internalsOf(api).store.remember(picked.vertex, picked.label);
              api.reveal(picked.vertex);
              setOpen(false);
            }}
          >
            <CommandInput
              {...tagKeys}
              aria-invalid={found === false || undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void addAll();
                  return;
                }
                tagKeys.onKeyDown?.(event);
              }}
              placeholder={found === false ? "The names could not be read." : placeholder}
            >
              {chips.value.map((value, index) => (
                <TagsInputItem index={index} key={value} value={value}>
                  <TagsInputItemPreview>
                    <TagsInputItemText>{value}</TagsInputItemText>
                    <TagsInputItemDeleteTrigger />
                  </TagsInputItemPreview>
                </TagsInputItem>
              ))}
            </CommandInput>
            <CommandContent>
              <Show when={found !== null}>
                <CommandEmpty>Nothing by that name.</CommandEmpty>
              </Show>
              <CommandList>
                {collection.group().map(([group, entries]) => (
                  <CommandGroup heading={heading(group)} key={group}>
                    {entries.map((item) => (
                      <CommandItem item={item} key={item.value}>
                        {glyph(item)}
                        <span className="min-w-0 truncate">
                          <Highlight ignoreCase matchAll query={terms} text={item.label} />
                        </span>
                        <Show when={item.detail !== ""}>
                          <span className="ms-auto shrink-0 ps-2 text-muted-foreground text-xs tabular-nums">{item.detail}</span>
                        </Show>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </CommandContent>
            <CommandFooter>
              {found && found.total > 0 ? (
                <>
                  <span className="min-w-0 truncate tabular-nums">
                    {found.total > limit
                      ? `First ${limit} of ${found.total.toLocaleString()} — keep typing to narrow it`
                      : `${found.total.toLocaleString()} ${found.total === 1 ? "match" : "matches"}`}
                    {found.outside > 0 ? ` · ${found.outside.toLocaleString()} more outside the subset` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="flex items-center gap-1 px-2">
                      Go to <Kbd>↵</Kbd>
                    </span>
                    <Button onClick={() => void addAll()} size="sm" variant="ghost">
                      Add {found.total.toLocaleString()} to the subset
                      <KbdGroup>
                        <Kbd>⌘</Kbd>
                        <Kbd>↵</Kbd>
                      </KbdGroup>
                    </Button>
                  </span>
                </>
              ) : found && found.outside > 0 ? (
                <span className="min-w-0 truncate tabular-nums">
                  None in the subset · {found.outside.toLocaleString()} outside it
                </span>
              ) : (
                <span className="min-w-0 truncate">
                  Narrow with <Kbd>type:Name</Kbd> or <Kbd>column:value</Kbd>, then Space.
                </span>
              )}
            </CommandFooter>
          </Command>
        </TagsInputRootProvider>
      </CommandDialogContent>
    </CommandDialog>
  );
}
