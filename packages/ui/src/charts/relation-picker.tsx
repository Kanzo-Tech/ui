"use client";

import type { EdgeType, Graph, Pattern, VertexPattern } from "@kanzo-tech/graphar-duckdb";
import { useId, useMemo } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { createListCollection } from "@ark-ui/react/collection";
import { ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";

/**
 * Every word the picker draws. A sentence is written from pieces — the types and the edge type, by
 * the names the graph gives them — and its pattern is an entry, so no sentence is English assembled in
 * place. No noun is inflected: a type is read as its name, singular, in every sentence.
 */
export interface RelationPickerTranslations {
  /** The group's accessible name. */
  relation: string;
  /** The root type's select. */
  root: string;
  /** The menu's trigger. */
  add: string;
  /** The heading over the out-edges, given the type they leave. */
  follow: (from: string) => string;
  /** The heading over the in-edges. */
  bringIn: string;
  /** A chip's remove button, given its sentence. */
  remove: (sentence: string) => string;
  /** A hop's fan-out, given the count — `1`, `≤1`, `~103` — and the type it leaves. */
  perRow: (count: string, from: string) => string;
  /** An out-edge, given the type it reaches and its edge type: *livesIn → Place*. */
  out: (to: string, label: string) => string;
  /** An in-edge, given the type it brings in, its edge type, and the type it reaches: *Person livesIn → this Place*. */
  in: (source: string, label: string, destination: string) => string;
}

/** Every type and edge type reads as the graph names it: no word is guessed from a name. */
const ENGLISH: RelationPickerTranslations = {
  relation: "Relation",
  root: "Root type",
  add: "Add related…",
  follow: (from) => `Follow from each ${from}`,
  bringIn: "Bring in what points at it",
  remove: (sentence) => `Remove ${sentence}`,
  perRow: (count, from) => `${count} per ${from}`,
  out: (to, label) => `${label} → ${to}`,
  in: (source, label, destination) => `${source} ${label} → this ${destination}`,
};

export interface RelationPickerProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The graph whose types and edge types the pattern walks. Their counts are what the fan-outs read. */
  graph: Graph;
  /** A pattern the picker made, or one of the same shape: a named vertex, then edge and named vertex. */
  value: Pattern;
  onValueChange: (pattern: Pattern) => void;
  /** The sentence for a hop along `edge`, where the default reads wrong — a self-edge's *parent* and *children*. */
  phrase?: (edge: EdgeType, direction: Direction) => string | undefined;
  translations?: Partial<RelationPickerTranslations>;
}

/** Above this many rows per row of the type a hop leaves, its fan-out warns. */
const WARN = 10;

type Direction = "out" | "in";

/** A hop that leaves a type: an edge type, which way it is walked, the type it reaches, and the rows it brings per row it leaves. */
interface Hop {
  readonly edge: EdgeType;
  readonly direction: Direction;
  readonly to: string;
  readonly fanOut: number | undefined;
}

/** Every hop that leaves `type`: its out-edges, then its in-edges, in the graph's order. */
function hopsOf(graph: Graph, type: string): Hop[] {
  const rows = graph.vertexTypes.find((t) => t.type === type)?.count;
  const fanOut = (e: EdgeType) => (rows ? e.count / rows : undefined);
  return [
    ...graph.edgeTypes.filter((e) => e.srcType === type).map((edge) => ({ edge, direction: "out" as const, to: edge.dstType, fanOut: fanOut(edge) })),
    ...graph.edgeTypes.filter((e) => e.dstType === type).map((edge) => ({ edge, direction: "in" as const, to: edge.srcType, fanOut: fanOut(edge) })),
  ];
}

/**
 * The variable a new vertex of `type` takes in `pattern`: the type's name, its first letter lower, and
 * a number after it where the pattern already names one so — `person`, `person2`.
 */
export function variableFor(pattern: Pattern, type: string): string {
  const base = type.charAt(0).toLowerCase() + type.slice(1);
  const taken = new Set(pattern.map((element) => element.as));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}${n}`;
  return name;
}

/** The sentence a hop reads as: the host's, else the pattern over the types' and the edge type's names. */
const sentenceOf = (t: RelationPickerTranslations, phrase: RelationPickerProps["phrase"], edge: EdgeType, direction: Direction) =>
  phrase?.(edge, direction) ?? (direction === "out" ? t.out(edge.dstType, edge.edgeType) : t.in(edge.srcType, edge.edgeType, edge.dstType));

/** *1*, *≤1*, *~103* — a fan-out as its item says it. */
const countOf = (fanOut: number) => (fanOut === 1 ? "1" : fanOut < 1 ? "≤1" : `~${Math.round(fanOut)}`);

/** One step, spelled: `>knows>Person`, `<hasCreator<Post`. */
const stepOf = ({ edge, direction, to }: Hop) => (direction === "out" ? `>${edge.edgeType}>${to}` : `<${edge.edgeType}<${to}`);

/**
 * **A pattern, picked as a path** — Looker's explore picker: a root type, then any number of hops,
 * each an edge to the type at its other end, every vertex named (`variableFor`) so its properties are
 * fields — `university.name`. Each hop reads as a sentence, says how many rows it
 * brings per row it leaves, and is a chip any of which can be taken back, cutting the path there.
 * The reasons are on `/docs/design/analytics`.
 *
 * ARIA: a `group` named "Relation". The root is a `Select`; "Add related…" a `Menu` of two labelled
 * groups, each item named by its sentence and described by its fan-out, and carrying its step as
 * `data-hop`; each chip's remove button is "Remove {sentence}". Every one of those words is an entry
 * of `translations`.
 */
export function RelationPicker(props: RelationPickerProps) {
  const { graph, value, onValueChange, phrase, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const id = useId();
  const roots = useMemo(
    () => createListCollection({ items: graph.vertexTypes.map((t) => t.type), itemToValue: (n) => n, itemToString: (n) => n }),
    [graph],
  );
  const vertexAt = (i: number) => value[i] as VertexPattern;
  const root = vertexAt(0)?.type ?? "";
  const start = (type: string) => onValueChange([{ as: variableFor([], type), type }]);

  // Each hop with the sentence it reads as: the edge at `2i + 1`, between the vertices beside it.
  const walked = Array.from({ length: (value.length - 1) / 2 }, (_, i) => {
    const element = value[2 * i + 1] as { edge: string; direction?: Direction };
    const direction = element.direction ?? "out";
    const [before, after] = [vertexAt(2 * i).type, vertexAt(2 * i + 2).type];
    const [src, dst] = direction === "out" ? [before, after] : [after, before];
    const edge = graph.edgeTypes.find((e) => e.edgeType === element.edge && e.srcType === src && e.dstType === dst);
    return { i, sentence: edge ? sentenceOf(t, phrase, edge, direction) : element.edge };
  });
  const last = vertexAt(value.length - 1)?.type ?? root;
  const byFanOut = (a: Hop, b: Hop) => (a.fanOut ?? Infinity) - (b.fanOut ?? Infinity);
  const next = hopsOf(graph, last).sort(byFanOut);
  const groups = [
    { heading: t.follow(last), hops: next.filter((h) => h.direction === "out") },
    { heading: t.bringIn, hops: next.filter((h) => h.direction === "in") },
  ].filter((g) => g.hops.length > 0);
  const add = (h: Hop) => onValueChange([...value, { edge: h.edge.edgeType, direction: h.direction }, { as: variableFor(value, h.to), type: h.to }]);

  return (
    <ark.div
      aria-label={t.relation}
      className={cn("flex min-w-0 flex-col gap-1", className)}
      role="group"
      {...rest}
      data-slot={slot ?? "relation-picker"}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Select
          collection={roots}
          onValueChange={(d) => d.value[0] && start(d.value[0])}
          value={[root]}
        >
          <SelectTrigger aria-label={t.root} className="w-auto min-w-28" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roots.items.map((name) => (
              <SelectItem item={name} key={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {walked.map(({ i, sentence }) => (
          <span className="inline-flex items-center gap-1.5 text-sm" data-slot="relation-picker-hop" key={i}>
            <ChevronRightIcon aria-hidden className="size-3.5 text-muted-foreground rtl:rotate-180" />
            <span className="inline-flex items-center rounded-md bg-muted ps-2">
              {sentence}
              <Button
                aria-label={t.remove(sentence)}
                className="text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                onClick={() => onValueChange(value.slice(0, 2 * i + 1))}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </span>
          </span>
        ))}
        {groups.length > 0 ? (
          <Menu positioning={{ placement: "bottom-start" }}>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <PlusIcon />
                {t.add}
              </Button>
            </MenuTrigger>
            <MenuContent>
              {groups.map((group) => (
                <MenuGroup heading={group.heading} key={group.heading}>
                  {group.hops.map((h) => {
                    const sentence = sentenceOf(t, phrase, h.edge, h.direction);
                    const step = stepOf(h);
                    const hint = `${id}-${h.direction}-${h.edge.name}`;
                    return (
                      <MenuItem
                        aria-describedby={h.fanOut === undefined ? undefined : hint}
                        aria-label={sentence}
                        className="justify-between gap-4"
                        data-hop={step}
                        key={step + h.edge.name}
                        onSelect={() => add(h)}
                        value={`${h.direction}:${h.edge.name}`}
                      >
                        {sentence}
                        {h.fanOut === undefined ? null : (
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              h.fanOut > WARN ? "text-warning-foreground" : "text-muted-foreground",
                            )}
                            data-warn={h.fanOut > WARN || undefined}
                            id={hint}
                          >
                            {t.perRow(countOf(h.fanOut), last)}
                          </span>
                        )}
                      </MenuItem>
                    );
                  })}
                </MenuGroup>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
      </div>
    </ark.div>
  );
}
