"use client";

import {
  Badge,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useChartCapacity,
} from "@kanzo-tech/ui";
import { LocateFixedIcon, WaypointsIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { neighbourIds, readVertex, type VertexDetail } from "../core/source";
import { localName, tableOf } from "../core/structure";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export interface GraphInspectorProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * More fields for the focused vertex, drawn after the corpus's values — a `DataListItem` each. A
   * render prop rather than a table of formatters: what a product adds is markup, and the part never
   * learns what any of it means.
   */
  children?: (detail: VertexDetail) => ReactNode;
}

/** A cell, as text — a `DATE` arrives as a `Date`, a `TIMESTAMP` as epoch milliseconds, and a 64-bit column as a `bigint`. */
const text = (value: unknown, date: boolean): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (date && typeof value === "number") return new Date(value).toISOString().replace("T", " ").slice(0, 19);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

const IRI = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
/** Past this many characters a value is clamped to three lines, and "more" lets the rest out. */
const LONG = 160;

/** One value: an IRI as a link out, long text clamped, the rest as it reads. */
function Value({ value, date }: { value: unknown; date: boolean }) {
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
        {open ? "less" : "more"}
      </Button>
    </>
  );
}

/** `null` is no such vertex in the corpus; `false` is a read that did not answer. */
type Answer<T> = { vertex: VertexId; value: T | null | false } | null;

/** Read `read(vertex)` for the focused vertex, keeping only the newest answer; a failure goes to `onFailure`. */
function useRead<T>(vertex: VertexId | null, read: ((vertex: VertexId) => Promise<T | null>) | null): T | null | false | undefined {
  const api = useGraphContext();
  const [answer, setAnswer] = useState<Answer<T>>(null);
  useEffect(() => {
    if (vertex === null || read === null) return;
    let current = true;
    read(vertex).then(
      (value) => current && setAnswer({ vertex, value }),
      (error: unknown) => {
        if (!current) return;
        setAnswer({ vertex, value: false });
        api.getState().options.onFailure(error);
      },
    );
    return () => {
      current = false;
    };
  }, [api, vertex, read]);
  return answer !== null && answer.vertex === vertex ? answer.value : undefined;
}

/**
 * **The focused vertex, fetched and laid out by the corpus's own tables** — the Linkurious inspector's
 * shape. The loaded graph carries what the channels project and nothing else, so the rest of the row
 * is read when a reader focuses it — one statement on its table, by its key, through the page's
 * coordinator.
 *
 * The header names the vertex — its `title`, else its IRI's local name, with the whole IRI in the
 * tooltip and behind the copy button beside it — and wears its type as a badge. Under it, two actions
 * that say what they do, in Linkurious's and Bloom's words: **Locate** frames it on the canvas, and
 * **Select neighbours** selects it with every vertex one edge away as an `"external"` selection, which
 * the page's crossfilter hears. The connections themselves are the
 * canvas's to show, so the panel does not list them a second time. Then the fields, two columns, in
 * the order the manifest declares them, grouped as its identity, its values and its dates. Sections
 * and rules, no card: inside a dock a card is a second border.
 */
export function GraphInspector({ children, className, slot, ...rest }: GraphInspectorProps) {
  const api = useGraphContext();
  const focus = useGraphState((s) => s.focus);
  const structure = useGraphState((s) => s.structure);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const { coordinator, categories } = options;
  const row = useMemo(
    () => (structure && coordinator ? (vertex: VertexId) => readVertex(coordinator, structure, vertex) : null),
    [coordinator, structure],
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
  const whole = typeof iri === "string" && iri !== "" ? iri : heading;
  const dated = (name: string) => /date|time/i.test(table?.columns.get(name)?.type ?? "");
  const groups = current
    ? [
        // The header already shows the identity when there is no title to show instead.
        { title: "Identity", fields: titled === undefined ? [] : current.fields.filter((f) => f.name === table?.identity) },
        { title: "Values", fields: current.fields.filter((f) => f.name !== table?.identity && !dated(f.name)) },
        { title: "Dates", fields: current.fields.filter((f) => f.name !== table?.identity && dated(f.name)) },
      ]
    : [];
  const selectNeighbours = async () => {
    if (!current || !structure || !coordinator) return;
    try {
      const around = await neighbourIds(coordinator, structure, current.vertex);
      api.select([current.vertex, ...around], "external", `Neighbours of ${heading}`);
    } catch (error) {
      api.getState().options.onFailure(error);
    }
  };

  return (
    <div {...rest} className={cn("space-y-3 text-sm", className)} data-slot={slot ?? "graph-inspector"}>
      <Show when={focus === null}>
        <p className="text-muted-foreground text-xs">Click a vertex on the canvas to inspect it.</p>
      </Show>
      <Show when={focus !== null && answered === undefined}>
        <Skeleton className="h-24 w-full" />
      </Show>
      <Show when={focus !== null && answered !== undefined && !current}>
        <p className="text-muted-foreground text-xs">
          {answered === null ? "This vertex is not in the corpus." : "This vertex could not be read."}
        </p>
      </Show>
      {current && (
        <>
          <header className="space-y-2">
            <div className="flex min-w-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="min-w-0 truncate font-semibold text-sm" data-slot="graph-inspector-title">
                    {heading}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>{whole}</TooltipContent>
              </Tooltip>
              <Show when={typeof iri === "string" && iri !== ""}>
                <Clipboard value={String(iri)}>
                  <ClipboardTrigger aria-label="Copy the IRI" />
                </Clipboard>
              </Show>
            </div>
            <Badge className="min-w-0 gap-1 text-[10px]" size="xs" variant="outline">
              <Show when={byType}>
                <ShapeGlyph className="size-2 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />
              </Show>
              <span className="truncate">{nameOf(current.table, categories)}</span>
            </Badge>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => api.reveal(current.vertex)} size="sm" variant="outline">
                <LocateFixedIcon aria-hidden />
                Locate
              </Button>
              <Button onClick={() => void selectNeighbours()} size="sm" variant="outline">
                <WaypointsIcon aria-hidden />
                Select neighbours
              </Button>
            </div>
          </header>
          {groups.map((group) => (
            <Show key={group.title} when={group.fields.length > 0 || (group.title === "Values" && !!children)}>
              <Separator />
              <section aria-label={group.title}>
                <p className="mb-1 font-medium text-muted-foreground text-xs">{group.title}</p>
                <DataList className="gap-0 text-xs" orientation="horizontal">
                  {group.fields.map((f) => (
                    <DataListItem className="items-baseline gap-3 py-0.5" key={f.name}>
                      <DataListItemLabel className="w-24 min-w-0 truncate font-normal" title={f.name}>
                        {f.name}
                      </DataListItemLabel>
                      <DataListItemValue className="min-w-0">
                        <Value date={dated(f.name)} value={f.value} />
                      </DataListItemValue>
                    </DataListItem>
                  ))}
                  {group.title === "Values" && children?.(current)}
                </DataList>
              </section>
            </Show>
          ))}
        </>
      )}
    </div>
  );
}
