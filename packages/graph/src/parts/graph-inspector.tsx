"use client";

import { ark } from "@ark-ui/react/factory";
import {
  Button,
  Clipboard,
  ClipboardTrigger,
  cn,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  Link,
  Separator,
  Show,
  Skeleton,
  useChartCapacity,
} from "@kanzo-tech/ui";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { tv } from "tailwind-variants";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { readVertex, type VertexDetail } from "../core/source";
import { localName, tableOf } from "../core/structure";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

/** The words the inspector writes itself; a field's name is the corpus's and is never reworded. */
export interface GraphInspectorTranslations {
  /** With nothing focused. */
  empty: string;
  /** A focused vertex the corpus does not hold. */
  missing: string;
  /** A focused vertex whose read did not answer. */
  unread: string;
  locate: string;
  /** The IRI's copy button. */
  copy: string;
  /** The two groups of fields. */
  values: string;
  dates: string;
  /** A long value's toggle. */
  more: string;
  less: string;
}

const ENGLISH: GraphInspectorTranslations = {
  empty: "Click a vertex on the canvas to inspect it.",
  missing: "This vertex is not in the corpus.",
  unread: "This vertex could not be read.",
  locate: "Locate",
  copy: "Copy the IRI",
  values: "Values",
  dates: "Dates",
  more: "more",
  less: "less",
};

export interface GraphInspectorProps extends Omit<React.ComponentProps<typeof ark.div>, "children"> {
  /**
   * More fields for the focused vertex, drawn after the corpus's values — a `DataListItem` each. A
   * render prop rather than a table of formatters: what a product adds is markup, and the part never
   * learns what any of it means.
   */
  children?: (detail: VertexDetail) => ReactNode;
  translations?: Partial<GraphInspectorTranslations>;
}

const graphInspector = tv({
  slots: {
    root: "space-y-3 text-sm",
    hint: "text-muted-foreground text-xs",
    header: "space-y-1",
    top: "flex items-start justify-between gap-2",
    name: "min-w-0",
    type: "flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs",
    glyph: "size-2.5 shrink-0",
    title: "truncate font-semibold text-base",
    iri: "flex min-w-0 items-center gap-1 text-xs",
    group: "mb-1 font-medium text-muted-foreground text-xs",
  },
});

/** A cell, as text — a `DATE` arrives as a `Date`, a `TIMESTAMP` as epoch milliseconds, and a 64-bit column as a `bigint`. */
const text = (value: unknown, date: boolean): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (date && typeof value === "number") return new Date(value).toISOString().replace("T", " ").slice(0, 19);
  if (value === null || value === undefined || value === "") return "—";
  // A `list` property arrives as an Arrow vector: its values, as the row reads them.
  if (typeof value === "object" && Symbol.iterator in value) return Array.from(value as Iterable<unknown>).map(String).join(", ");
  return String(value);
};

const IRI = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
/** Past this many characters a value is clamped to three lines, and "more" lets the rest out. */
const LONG = 160;

/**
 * How every row lays out, a host's among them: set on the list, so a `DataListItem` the render prop
 * draws lines up with the corpus's without restating a class.
 */
const rows = cn(
  "gap-0 text-xs",
  "[&_[data-slot=data-list-item]]:items-baseline [&_[data-slot=data-list-item]]:gap-3 [&_[data-slot=data-list-item]]:py-0.5",
  "[&_[data-slot=data-list-item-label]]:w-24 [&_[data-slot=data-list-item-label]]:min-w-0 [&_[data-slot=data-list-item-label]]:truncate [&_[data-slot=data-list-item-label]]:font-normal",
  "[&_[data-slot=data-list-item-value]]:min-w-0",
);

/** One value: an IRI as a link out, long text clamped, the rest as it reads. */
function Value({ value, date, t }: { value: unknown; date: boolean; t: GraphInspectorTranslations }) {
  const [open, setOpen] = useState(false);
  const shown = text(value, date);
  if (typeof value === "string" && IRI.test(value)) {
    return (
      <Link className="break-all" href={value} rel="noreferrer" target="_blank">
        {value}
      </Link>
    );
  }
  if (shown.length <= LONG) return <span className="break-words">{shown}</span>;
  return (
    <>
      <span className={cn("break-words", !open && "line-clamp-3")}>{shown}</span>
      <Button className="h-auto p-0 text-xs" onClick={() => setOpen(!open)} size="sm" variant="link">
        {open ? t.less : t.more}
      </Button>
    </>
  );
}

/** `null` is no such vertex in the corpus; `false` is a read that did not answer. */
type Answer<T> = { vertex: VertexId; value: T | null | false } | null;

/**
 * Read `read(vertex)` for the focused vertex, keeping only the newest answer; a failure goes to
 * `onFailure`. The read the reader moved on from is stopped, not only ignored.
 */
function useRead<T>(
  vertex: VertexId | null,
  read: ((vertex: VertexId, signal: AbortSignal) => Promise<T | null>) | null,
): T | null | false | undefined {
  const api = useGraphContext();
  const [answer, setAnswer] = useState<Answer<T>>(null);
  useEffect(() => {
    if (vertex === null || read === null) return;
    const stop = new AbortController();
    read(vertex, stop.signal).then(
      (value) => stop.signal.aborted || setAnswer({ vertex, value }),
      (error: unknown) => {
        if (stop.signal.aborted) return;
        setAnswer({ vertex, value: false });
        api.getState().options.onFailure(error);
      },
    );
    return () => stop.abort();
  }, [api, vertex, read]);
  return answer !== null && answer.vertex === vertex ? answer.value : undefined;
}

/**
 * **The focused vertex, fetched and laid out by the corpus's own tables** — the Linkurious inspector's
 * shape. The loaded graph carries what the channels project and nothing else, so the rest of the row
 * is read when a reader focuses it — one statement on its table, by its key, on the page's engine;
 * focusing another vertex stops it.
 *
 * The header names the vertex: its type over it, with the canvas's glyph when colour is the type;
 * its `title`, else its IRI's local name; and **Locate** beside it, which frames it with its
 * neighbours on the canvas and keeps the camera there. Under the name, the IRI itself — a link out,
 * with the copy button beside it, because the IRI is what a reader carries elsewhere. Nothing
 * selects the neighbours here: a click on the canvas already does, and so does Locate. Then the
 * fields, two columns, in the order the manifest declares them, grouped as values and dates; a row
 * the render prop adds lines up with them. Sections
 * and rules, no card: inside a dock a card is a second border.
 */
export function GraphInspector({ children, className, slot, translations, ...rest }: GraphInspectorProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphInspector();
  const api = useGraphContext();
  const focus = useGraphState((s) => s.focus);
  const structure = useGraphState((s) => s.structure);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const { engine, categories } = options;
  const row = useMemo(
    () => (structure && engine ? (vertex: VertexId, signal: AbortSignal) => readVertex(engine, structure, vertex, signal) : null),
    [engine, structure],
  );
  const answered = useRead(focus, row);

  const current = answered || null;
  const table = structure && current ? tableOf(structure, current.vertex) : undefined;
  const field = (name: string | undefined) => current?.fields.find((f) => f.name === name)?.value;
  // The badge is the vertex's type, and wears the canvas's glyph only when the type is what the canvas colours by.
  const byType = bindingOf(options).byTable;
  const rank = Math.max(0, domain.findIndex((value) => String(value) === current?.table));
  const iri = field(table?.identity);
  const titled = field(options.title);
  const named = titled ?? (typeof iri === "string" && iri !== "" ? localName(iri) : iri);
  const heading = current ? (named === undefined || named === null ? `#${current.vertex}` : text(named, false)) : "";
  const dated = (name: string) => /date|time/i.test(table?.columns.get(name)?.type ?? "");
  const groups = current
    ? [
        { key: "values", title: t.values, fields: current.fields.filter((f) => f.name !== table?.identity && !dated(f.name)) },
        { key: "dates", title: t.dates, fields: current.fields.filter((f) => f.name !== table?.identity && dated(f.name)) },
      ]
    : [];

  return (
    <ark.div {...rest} className={cn(styles.root(), className)} data-slot={slot ?? "graph-inspector"}>
      <Show when={focus === null}>
        <p className={styles.hint()}>{t.empty}</p>
      </Show>
      <Show when={focus !== null && answered === undefined}>
        <Skeleton className="h-24 w-full" />
      </Show>
      <Show when={focus !== null && answered !== undefined && !current}>
        <p className={styles.hint()}>{answered === null ? t.missing : t.unread}</p>
      </Show>
      {current && (
        <>
          <header className={styles.header()}>
            <div className={styles.top()}>
              <div className={styles.name()}>
                <p className={styles.type()} data-slot="graph-inspector-type">
                  <Show when={byType}>
                    <ShapeGlyph aria-hidden className={styles.glyph()} color={scale.color(rank)} shape={scale.shape(rank)} />
                  </Show>
                  <span className="truncate">{nameOf(current.table, categories)}</span>
                </p>
                <h3 className={styles.title()} data-slot="graph-inspector-title" title={heading}>
                  {heading}
                </h3>
              </div>
              <Button className="shrink-0" onClick={() => api.reveal(current.vertex)} size="sm" variant="outline">
                <LocateFixedIcon aria-hidden />
                {t.locate}
              </Button>
            </div>
            <Show when={typeof iri === "string" && iri !== ""}>
              <div className={styles.iri()} data-slot="graph-inspector-iri">
                <Link className="min-w-0 truncate text-muted-foreground" href={String(iri)} rel="noreferrer" target="_blank" title={String(iri)}>
                  {String(iri)}
                </Link>
                <Clipboard className="-my-1 shrink-0" value={String(iri)}>
                  <ClipboardTrigger aria-label={t.copy} />
                </Clipboard>
              </div>
            </Show>
          </header>
          {groups.map((group) => (
            <Show key={group.key} when={group.fields.length > 0 || (group.key === "values" && !!children)}>
              <Separator />
              <section aria-label={group.title}>
                <p className={styles.group()}>{group.title}</p>
                <DataList className={rows} orientation="horizontal">
                  {group.fields.map((f) => (
                    <DataListItem key={f.name}>
                      <DataListItemLabel title={f.name}>{f.name}</DataListItemLabel>
                      <DataListItemValue>
                        <Value date={dated(f.name)} t={t} value={f.value} />
                      </DataListItemValue>
                    </DataListItem>
                  ))}
                  {group.key === "values" && children?.(current)}
                </DataList>
              </section>
            </Show>
          ))}
        </>
      )}
    </ark.div>
  );
}
