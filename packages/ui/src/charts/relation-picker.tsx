"use client";

import { relationHops, type Hop, type JoinEdge, type JoinGraph, type Relation, type RelationHop } from "@kanzo-tech/mosaic";
import { useId, useMemo } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { createListCollection } from "@ark-ui/react/collection";
import { ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";

export interface RelationPickerProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The types and the edges between them. A type's and an edge's `rows` are what the fan-outs and the grain line read. */
  graph: JoinGraph;
  value: Relation;
  onValueChange: (relation: Relation) => void;
  /** The sentence for a hop along `edge`, where the default reads wrong — a self-edge's *parent* and *children*. */
  phrase?: (edge: JoinEdge, direction: Hop["direction"]) => string | undefined;
  /** A type's plural, where adding *s* reads wrong: `Person` → *People*. */
  plural?: (type: string) => string | undefined;
}

/** Above this many rows per row of the type a hop leaves, its fan-out warns. */
const WARN = 10;

/** `isLocatedIn` → `is located in`, `TagClass` → `tag class`; an acronym keeps its case. */
const words = (name: string) =>
  name
    .split(/(?<=[a-z0-9])(?=[A-Z])|[_\s]+/)
    .filter(Boolean)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pluralWord = (w: string) => (/(s|x|z|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);

interface Wording {
  noun: (type: string) => string;
  nouns: (type: string) => string;
  sentence: (edge: JoinEdge, direction: Hop["direction"]) => string;
}

/**
 * The templates: an out-edge reads *The {to} it {label}*, an in-edge *{To}s {label} this {from}*,
 * the label's verb bent to its subject — `has` becomes *whose …*, `is` drops out of the plural, a
 * verb loses its *s*.
 */
function wording(phrase: RelationPickerProps["phrase"], plural: RelationPickerProps["plural"]): Wording {
  const noun = (type: string) => words(type).join(" ");
  const nouns = (type: string) => {
    const host = plural?.(type);
    if (host) return host.toLowerCase();
    const w = words(type);
    return [...w.slice(0, -1), pluralWord(w.at(-1) ?? type)].join(" ");
  };
  const sentence = (edge: JoinEdge, direction: Hop["direction"]) => {
    const host = phrase?.(edge, direction);
    if (host) return host;
    const [verb = "", ...rest] = words(edge.label);
    const tail = rest.join(" ");
    const verbal = verb === "is" || (verb.endsWith("s") && !verb.endsWith("ss"));
    if (direction === "out") {
      const to = noun(edge.destination);
      if (verb === "has") return `The ${to} that is its ${tail}`;
      return `The ${to} it ${verbal ? "" : "is "}${words(edge.label).join(" ")}`;
    }
    const [to, from] = [capital(nouns(edge.source)), noun(edge.destination)];
    if (verb === "has") return `${to} whose ${tail} is this ${from}`;
    if (verb === "is") return `${to} ${tail} this ${from}`;
    if (verbal) return `${to} that ${[verb.slice(0, -1), tail].filter(Boolean).join(" ")} this ${from}`;
    return `${to} that are ${words(edge.label).join(" ")} this ${from}`;
  };
  return { noun, nouns, sentence };
}

/** *1 per Place*, *≤1 per Place*, *~103 per Place*. */
const perRow = (fanOut: number, from: string) =>
  `${fanOut === 1 ? "1" : fanOut < 1 ? "≤1" : `~${Math.round(fanOut)}`} per ${from}`;

/** The canonical spelling of one step, as `relationKey` writes it: `>knows>Person`, `<hasCreator<Post`. */
const stepOf = ({ hop, label, to }: Pick<RelationHop, "hop" | "label" | "to">) =>
  hop.direction === "out" ? `>${label}>${to}` : `<${label}<${to}`;

/**
 * **A relation, picked as a path** — Looker's explore picker: a root type, then any number of hops,
 * each an edge to the type at its other end. Each hop reads as a sentence, says how many rows it
 * brings per row it leaves, and is a chip any of which can be taken back, cutting the path there.
 * Under the chips, the grain: what one row now is, how many there are, and which roots the inner
 * join leaves out. The reasons are on `/docs/design/analytics`.
 *
 * ARIA: a `group` named "Relation". The root is a `Select`; "Add related…" a `Menu` of two labelled
 * groups, each item named by its sentence and described by its fan-out, and carrying its step as
 * `data-hop`; each chip's remove button is "Remove {sentence}"; the grain line is a `status`.
 */
export function RelationPicker(props: RelationPickerProps) {
  const { graph, value, onValueChange, phrase, plural, className, slot, ...rest } = props;
  const id = useId();
  const roots = useMemo(
    () => createListCollection({ items: graph.types.map((t) => t.name), itemToValue: (n) => n, itemToString: (n) => n }),
    [graph],
  );
  const say = wording(phrase, plural);
  const rowsOf = (type: string) => graph.types.find((t) => t.name === type)?.rows;

  // Each hop with the sentence it reads as, and the rows the path holds once it is taken.
  let rows = rowsOf(value.root);
  const walked = value.path.map((hop, i) => {
    const edge = graph.edges.find((e) => e.name === hop.edge);
    const from = hop.direction === "out" ? edge?.source : edge?.destination;
    const to = (hop.direction === "out" ? edge?.destination : edge?.source) ?? "";
    const fanOut = edge?.rows === undefined || !from ? undefined : edge.rows / (rowsOf(from) ?? NaN);
    rows = rows === undefined || fanOut === undefined || !Number.isFinite(fanOut) ? undefined : rows * fanOut;
    return { i, to, sentence: edge ? say.sentence(edge, hop.direction) : hop.edge };
  });
  const last = walked.at(-1)?.to ?? value.root;
  const byFanOut = (a: RelationHop, b: RelationHop) => (a.fanOut ?? Infinity) - (b.fanOut ?? Infinity);
  const next = relationHops(graph, last).sort(byFanOut);
  const groups = [
    { heading: `Follow from each ${last}`, hops: next.filter((h) => h.hop.direction === "out") },
    { heading: "Bring in what points at it", hops: next.filter((h) => h.hop.direction === "in") },
  ].filter((g) => g.hops.length > 0);
  const grain = [
    `One row per ${last}`,
    rows === undefined ? null : `${walked.length > 1 ? "~" : ""}${Math.round(rows).toLocaleString()} rows`,
    walked.length ? `${capital(say.nouns(value.root))} without ${say.nouns(last)} are left out` : null,
  ];

  return (
    <ark.div
      aria-label="Relation"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      role="group"
      {...rest}
      data-slot={slot ?? "relation-picker"}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Select
          collection={roots}
          onValueChange={(d) => d.value[0] && onValueChange({ root: d.value[0], path: [] })}
          value={[value.root]}
        >
          <SelectTrigger aria-label="Root type" className="w-auto min-w-28" size="sm">
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
                aria-label={`Remove ${sentence}`}
                className="text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                onClick={() => onValueChange({ root: value.root, path: value.path.slice(0, i) })}
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
                Add related…
              </Button>
            </MenuTrigger>
            <MenuContent>
              {groups.map((group) => (
                <MenuGroup heading={group.heading} key={group.heading}>
                  {group.hops.map((h) => {
                    const edge = graph.edges.find((e) => e.name === h.hop.edge)!;
                    const sentence = say.sentence(edge, h.hop.direction);
                    const step = stepOf(h);
                    const hint = `${id}-${h.hop.direction}-${h.hop.edge}`;
                    return (
                      <MenuItem
                        aria-describedby={h.fanOut === undefined ? undefined : hint}
                        aria-label={sentence}
                        className="justify-between gap-4"
                        data-hop={step}
                        key={step + h.hop.edge}
                        onSelect={() => onValueChange({ root: value.root, path: [...value.path, h.hop] })}
                        value={`${h.hop.direction}:${h.hop.edge}`}
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
                            {perRow(h.fanOut, last)}
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
      <p className="text-muted-foreground text-xs" data-slot="relation-picker-grain" role="status">
        {grain.filter(Boolean).join(" · ")}
      </p>
    </ark.div>
  );
}
