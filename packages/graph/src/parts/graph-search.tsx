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
  useLocale,
  useTagsInput,
} from "@kanzo-tech/ui";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { tv } from "tailwind-variants";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { localName, matchingIds, parseQuery, searchVertices, tableOf, vertexTypes, type Found, type VertexQuery } from "../core/source";
import { internalsOf } from "../react/use-graph";
import { useGraphContext } from "../react/graph-root";
import { usePick } from "../react/use-pick";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

/**
 * Every word the search writes. A figure arrives formatted in the page's locale, and where a message
 * has two forms the pattern is handed the number too, to choose with `Intl.PluralRules` or as English
 * does — never to inflect a label.
 */
export interface GraphSearchTranslations {
  /** On the cue in the page, and in the palette's empty input. */
  placeholder: string;
  /** The palette's accessible name and description. */
  title: string;
  description: string;
  /** In the input, when the read failed. */
  unread: string;
  /** The empty palette's two groups, and a typed search that found nothing. */
  recent: string;
  narrow: string;
  empty: string;
  /** The footer: more matched than the list shows; how many matched; how many the subset leaves out; none in it. */
  first: (shown: string, total: string) => string;
  matches: (count: string, n: number) => string;
  outside: (count: string) => string;
  noneInside: (count: string) => string;
  /** Beside the Enter key, and the button that picks every match. */
  goTo: string;
  addAll: (count: string) => string;
  /** The footer of an empty palette, given the two prefixes as keys. */
  prefixes: (type: ReactNode, column: ReactNode) => ReactNode;
  separator: string;
}

const ENGLISH: GraphSearchTranslations = {
  placeholder: "Find a node…",
  title: "Find a node",
  description: "Find a vertex by its name, its type or a column.",
  unread: "The names could not be read.",
  recent: "Recent",
  narrow: "Narrow to a type",
  empty: "Nothing by that name.",
  first: (shown, total) => `First ${shown} of ${total} — keep typing to narrow it`,
  matches: (count, n) => `${count} ${n === 1 ? "match" : "matches"}`,
  outside: (count) => `${count} more outside the subset`,
  noneInside: (count) => `None in the subset · ${count} outside it`,
  goTo: "Go to",
  addAll: (count) => `Add ${count} to the subset`,
  prefixes: (type, column) => <>Narrow with {type} or {column}, then Space.</>,
  separator: " · ",
};

/** The cue's props: it is a `Button`, and takes everything one does — `size`, `className`, `asChild`. */
export interface GraphSearchProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
  /** How many matches the list shows; past it, the list says to keep typing. */
  limit?: number;
  translations?: Partial<GraphSearchTranslations>;
}

const graphSearch = tv({
  slots: {
    cue: "w-full justify-start font-normal text-muted-foreground",
    keys: "ms-auto",
    palette: "h-[min(40rem,calc(100dvh-4rem))]",
    field: "min-h-0 flex-1",
    glyph: "size-2.5 shrink-0",
    heading: "flex w-full items-center justify-between gap-2",
    count: "font-normal tabular-nums",
    label: "min-w-0 truncate",
    detail: "ms-auto shrink-0 ps-2 text-muted-foreground text-xs tabular-nums",
    footer: "min-w-0 truncate tabular-nums",
    actions: "flex shrink-0 items-center gap-1",
    go: "flex items-center gap-1 px-2",
  },
});

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
 * contain. Each pause in typing asks the graph once, on the page's engine, for the first
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
export function GraphSearch({ className, limit = 50, size = "sm", translations, ...rest }: GraphSearchProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphSearch();
  const { locale } = useLocale();
  const figure = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const n = (value: number) => figure.format(value);
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
  const { title, categories, engine } = options;
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
    if (!structure || !engine || input === "") return;
    // A pause in typing that moved on stops the search it asked, so it does not hold the connection.
    const stop = new AbortController();
    const query = parseQuery(input, structure);
    const timer = setTimeout(() => {
      searchVertices(engine, structure, { query, title, limit, subset: predicate() }, stop.signal).then(
        (found) => stop.signal.aborted || setAnswered({ input, query, found }),
        (error: unknown) => {
          if (stop.signal.aborted) return;
          setAnswered({ input, query, found: false });
          api.getState().options.onFailure(error);
        },
      );
    }, PAUSE);
    return () => {
      stop.abort();
      clearTimeout(timer);
    };
  }, [api, predicate, structure, engine, input, title, limit]);

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
      ...(structure ? vertexTypes(structure) : []).map((table) => ({
        value: `type:${table.name}`,
        vertex: null,
        label: nameOf(table.name, categories),
        detail: figure.format(table.rows ?? 0),
        group: TYPES,
      })),
    ];
  }, [typed, found, recent, structure, categories, figure]);
  const collection = useMemo(() => createListCollection({ items, groupBy: (item) => item.group }), [items]);
  const terms = result ? [result.query.text, ...result.query.fields.map((f) => f.value)].filter((term) => term !== "") : [];

  const glyph = (item: Entry) => {
    // A type wears the glyph its vertices do only when the type is what the canvas colours by.
    const typeRank = binding.byTable ? domain.findIndex((value) => `type:${String(value)}` === item.value) : -1;
    const rank = item.vertex === null ? (typeRank < 0 ? undefined : typeRank) : encoding?.ranks[item.vertex];
    if (!bound || rank === undefined) return null;
    return <ShapeGlyph aria-hidden className={styles.glyph()} color={scale.color(rank)} shape={scale.shape(rank)} />;
  };
  const heading = (group: string) => {
    if (group === RECENT) return t.recent;
    if (group === TYPES) return t.narrow;
    const count = found ? found.byType.get(group) : undefined;
    return (
      <span className={styles.heading()}>
        <span className="truncate">{nameOf(group, categories)}</span>
        <span className={styles.count()}>{count === undefined ? null : n(count)}</span>
      </span>
    );
  };
  const addAll = async () => {
    if (!structure || !engine || !result) return;
    try {
      search.pick(await matchingIds(engine, structure, result.query, { title, subset: predicate() }), `“${result.input}”`);
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
          disabled={structure === null}
          size={size}
          variant="outline"
          {...rest}
          className={cn(styles.cue(), className)}
        >
          <SearchIcon aria-hidden />
          <span className={styles.label()}>{t.placeholder}</span>
          <KbdGroup className={styles.keys()}>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </DialogTrigger>
      <CommandDialogContent className={styles.palette()} description={t.description} title={t.title}>
        <TagsInputRootProvider className={styles.field()} value={chips}>
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
              placeholder={found === false ? t.unread : t.placeholder}
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
                <CommandEmpty>{t.empty}</CommandEmpty>
              </Show>
              <CommandList>
                {collection.group().map(([group, entries]) => (
                  <CommandGroup heading={heading(group)} key={group}>
                    {entries.map((item) => (
                      <CommandItem item={item} key={item.value}>
                        {glyph(item)}
                        <span className={styles.label()}>
                          <Highlight ignoreCase matchAll query={terms} text={item.label} />
                        </span>
                        <Show when={item.detail !== ""}>
                          <span className={styles.detail()}>{item.detail}</span>
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
                  <span className={styles.footer()}>
                    {found.total > limit ? t.first(n(limit), n(found.total)) : t.matches(n(found.total), found.total)}
                    {found.outside > 0 ? `${t.separator}${t.outside(n(found.outside))}` : ""}
                  </span>
                  <span className={styles.actions()}>
                    <span className={styles.go()}>
                      {t.goTo} <Kbd>↵</Kbd>
                    </span>
                    <Button onClick={() => void addAll()} size="sm" variant="ghost">
                      {t.addAll(n(found.total))}
                      <KbdGroup>
                        <Kbd>⌘</Kbd>
                        <Kbd>↵</Kbd>
                      </KbdGroup>
                    </Button>
                  </span>
                </>
              ) : found && found.outside > 0 ? (
                <span className={styles.footer()}>{t.noneInside(n(found.outside))}</span>
              ) : (
                <span className={styles.label()}>{t.prefixes(<Kbd>type:Name</Kbd>, <Kbd>column:value</Kbd>)}</span>
              )}
            </CommandFooter>
          </Command>
        </TagsInputRootProvider>
      </CommandDialogContent>
    </CommandDialog>
  );
}
