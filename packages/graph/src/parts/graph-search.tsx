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
import { tableOf } from "../core/structure";
import { internalsOf } from "../react/use-graph";
import { useGraphContext } from "../react/graph-root";
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
  vertex: number;
  label: string;
  /** Its vertex table, or {@link RECENT} for a vertex the search went to before. */
  group: string;
}

/** What one query answered, or `false` when the read failed. */
type Answered = { input: string; query: VertexQuery; found: Found | false } | null;

/** How long a reader pauses before the text is asked for: one statement per pause, not per key. */
const PAUSE = 150;
const RECENT = "\0recent";

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
 * Matches are grouped by vertex type, named by the root's `categories` and counted past the limit,
 * each with the glyph the canvas draws it in. **Enter** reveals the highlighted one — the canvas frames
 * it and selects it with its neighbours — closes the palette, and puts it at the head of the recents
 * the empty palette shows, kept by the root while it lives. **⌘Enter** selects every match as an
 * `"external"` selection.
 *
 * A read that fails is handed to `onFailure` whole and the input says so.
 *
 * ARIA: a `button` declaring `aria-keyshortcuts`, opening a `dialog` that holds Ark's combobox — a
 * `combobox` input over a `listbox` of `option`s in labelled groups.
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

  const typed = input !== "";
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
      api.select(await matchingIds(coordinator, structure, result.query, title), "external", `Matches for “${result.input}”`);
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
                  void selectAll();
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
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd> to go to it
                </span>
                <Button onClick={() => void selectAll()} size="sm" variant="ghost">
                  Select {found ? found.total.toLocaleString() : 0} matches
                  <KbdGroup>
                    <Kbd>⌘</Kbd>
                    <Kbd>↵</Kbd>
                  </KbdGroup>
                </Button>
              </CommandFooter>
            </Show>
          </Command>
        </TagsInputRootProvider>
      </CommandDialogContent>
    </CommandDialog>
  );
}
