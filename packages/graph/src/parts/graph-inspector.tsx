"use client";

import {
  Badge,
  Button,
  cn,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  Show,
  Skeleton,
  useChartCapacity,
} from "@kanzo-tech/ui";
import { CrosshairIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { readVertex, type VertexDetail } from "../core/detail";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export interface GraphInspectorProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * More fields for the focused vertex, drawn inside its list after the corpus's own — a
   * `DataListItem` each. A render prop rather than a table of formatters: what a product adds is
   * markup, and the part never learns what any of it means.
   */
  children?: (detail: VertexDetail) => ReactNode;
}

/** A cell, as text — a `DATE` arrives as a `Date`, and a 64-bit column as a `bigint`. */
const text = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

/** `null` is no such vertex in the corpus; `false` is a read that did not answer. */
type Answer = { vertex: VertexId; detail: VertexDetail | null | false } | null;

/**
 * **The focused vertex, fetched and laid out by the corpus's own tables.** The loaded graph carries
 * what the channels project and nothing else, so the rest of the row is read when a reader focuses
 * it — a scan of its table, filtered to its key, cancelled when the focus moves on. The fields are the
 * table's, in the order the manifest declares them; the key and the position are the canvas's.
 */
export function GraphInspector({ children, className, slot, ...rest }: GraphInspectorProps) {
  const api = useGraphContext();
  const focus = useGraphState((s) => s.focus);
  const corpus = useGraphState((s) => s.corpus);
  const geometry = useGraphSnapshot((s) => s.geometry);
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const [answer, setAnswer] = useState<Answer>(null);

  useEffect(() => {
    if (focus === null || !corpus || !geometry) return;
    const aborter = new AbortController();
    readVertex(corpus, geometry, focus, aborter.signal).then(
      (detail) => !aborter.signal.aborted && setAnswer({ vertex: focus, detail }),
      (error: unknown) => {
        if (aborter.signal.aborted) return;
        setAnswer({ vertex: focus, detail: false });
        api.getState().options.onFailure(error);
      },
    );
    return () => aborter.abort();
  }, [api, corpus, focus, geometry]);

  const answered = answer !== null && answer.vertex === focus ? answer.detail : undefined;
  const current = answered || null;
  const field = (name: string | undefined) => current?.fields.find((f) => f.name === name)?.value;
  const binding = bindingOf(options);
  const category = binding.byTable ? current?.table : field(binding.category);
  const rank = domain.findIndex((value) => String(value) === String(category));
  const bound = binding.byTable || binding.category !== undefined;
  const identity = geometry?.tables.find((table) => table.name === current?.table)?.identity;
  const heading = field(options.title) ?? field(identity);

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
          <div>
            <p className="truncate font-medium" data-slot="graph-inspector-title">
              {heading === undefined || heading === null ? `#${current.vertex}` : text(heading)}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <Show when={bound}>
                <Badge className="gap-1 text-[10px]" size="xs" variant="outline">
                  <ShapeGlyph
                    className="size-2 shrink-0"
                    color={scale.color(Math.max(0, rank))}
                    shape={scale.shape(Math.max(0, rank))}
                  />
                  {nameOf(category, options.categories)}
                </Badge>
              </Show>
              <Button
                className="h-5 gap-1 text-[10px]"
                onClick={() => api.reveal(current.vertex)}
                size="sm"
                title="Bring this vertex into view on the canvas"
                variant="ghost"
              >
                <CrosshairIcon className="size-3" />
                Find on canvas
              </Button>
            </div>
          </div>
          <DataList orientation="vertical">
            {current.fields.map((f) => (
              <DataListItem className="gap-0.5 py-0" key={f.name}>
                <DataListItemLabel className="text-xs">{f.name}</DataListItemLabel>
                <DataListItemValue className="break-all">{text(f.value)}</DataListItemValue>
              </DataListItem>
            ))}
            {children?.(current)}
          </DataList>
        </>
      )}
    </div>
  );
}
