"use client";

import {
  edgeWords,
  relationHops,
  typeWords,
  type Hop,
  type JoinEdge,
  type JoinGraph,
  type Relation,
  type RelationHop,
} from "@kanzo-tech/relations";
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
 * Every word the picker draws. A sentence is written from pieces — the types and the edge's label in
 * words — and its pattern is an entry, so no sentence is English assembled in place. No noun is
 * inflected: a type is read as its label, singular, in every sentence, because no labelling
 * vocabulary carries a plural.
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
  /** An out-edge, given the type it reaches and its label in words: *The place it is part of*. */
  out: (to: string, label: string) => string;
  /** An in-edge, given the type it brings in, its label in words, and the type it reaches: *Comment · located in this place*. */
  in: (source: string, label: string, destination: string) => string;
}

/** `has` reads *whose …*, a lone `is` drops out, and any other label reads as written, singular. */
const ENGLISH: RelationPickerTranslations = {
  relation: "Relation",
  root: "Root type",
  add: "Add related…",
  follow: (from) => `Follow from each ${from}`,
  bringIn: "Bring in what points at it",
  remove: (sentence) => `Remove ${sentence}`,
  perRow: (count, from) => `${count} per ${from}`,
  out: (to, label) => {
    const [verb = "", ...rest] = label.split(" ");
    if (verb === "has") return `The ${to} that is its ${rest.join(" ")}`;
    const verbal = verb === "is" || (verb.endsWith("s") && !verb.endsWith("ss"));
    return `The ${to} it ${verbal ? "" : "is "}${label}`;
  },
  in: (source, label, destination) => {
    const [verb = "", ...rest] = label.split(" ");
    const said = verb === "has" ? `whose ${rest.join(" ")} is` : verb === "is" ? rest.join(" ") : label;
    return `${capital(source)} · ${said} this ${destination}`;
  },
};

export interface RelationPickerProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The types and the edges between them. A type's and an edge's `rows` are what the fan-outs read. */
  graph: JoinGraph;
  value: Relation;
  onValueChange: (relation: Relation) => void;
  /** The sentence for a hop along `edge`, where the default reads wrong — a self-edge's *parent* and *children*. */
  phrase?: (edge: JoinEdge, direction: Hop["direction"]) => string | undefined;
  translations?: Partial<RelationPickerTranslations>;
}

/** Above this many rows per row of the type a hop leaves, its fan-out warns. */
const WARN = 10;

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The sentence a hop reads as: the host's, else the pattern over the types' and the label's words. */
const sentenceOf = (
  graph: JoinGraph,
  t: RelationPickerTranslations,
  phrase: RelationPickerProps["phrase"],
  edge: JoinEdge,
  direction: Hop["direction"],
) =>
  phrase?.(edge, direction) ??
  (direction === "out"
    ? t.out(typeWords(graph, edge.destination), edgeWords(edge))
    : t.in(typeWords(graph, edge.source), edgeWords(edge), typeWords(graph, edge.destination)));

/** *1*, *≤1*, *~103* — a fan-out as its item says it. */
const countOf = (fanOut: number) => (fanOut === 1 ? "1" : fanOut < 1 ? "≤1" : `~${Math.round(fanOut)}`);

/** The canonical spelling of one step, as `relationKey` writes it: `>knows>Person`, `<hasCreator<Post`. */
const stepOf = ({ hop, label, to }: Pick<RelationHop, "hop" | "label" | "to">) =>
  hop.direction === "out" ? `>${label}>${to}` : `<${label}<${to}`;

/**
 * **A relation, picked as a path** — Looker's explore picker: a root type, then any number of hops,
 * each an edge to the type at its other end. Each hop reads as a sentence, says how many rows it
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
    () => createListCollection({ items: graph.types.map((t) => t.name), itemToValue: (n) => n, itemToString: (n) => n }),
    [graph],
  );

  // Each hop with the sentence it reads as.
  const walked = value.path.map((hop, i) => {
    const edge = graph.edges.find((e) => e.name === hop.edge);
    const to = (hop.direction === "out" ? edge?.destination : edge?.source) ?? "";
    return { i, to, sentence: edge ? sentenceOf(graph, t, phrase, edge, hop.direction) : hop.edge };
  });
  const last = walked.at(-1)?.to ?? value.root;
  const byFanOut = (a: RelationHop, b: RelationHop) => (a.fanOut ?? Infinity) - (b.fanOut ?? Infinity);
  const next = relationHops(graph, last).sort(byFanOut);
  const groups = [
    { heading: t.follow(last), hops: next.filter((h) => h.hop.direction === "out") },
    { heading: t.bringIn, hops: next.filter((h) => h.hop.direction === "in") },
  ].filter((g) => g.hops.length > 0);

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
          onValueChange={(d) => d.value[0] && onValueChange({ root: d.value[0], path: [] })}
          value={[value.root]}
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
                {t.add}
              </Button>
            </MenuTrigger>
            <MenuContent>
              {groups.map((group) => (
                <MenuGroup heading={group.heading} key={group.heading}>
                  {group.hops.map((h) => {
                    const edge = graph.edges.find((e) => e.name === h.hop.edge)!;
                    const sentence = sentenceOf(graph, t, phrase, edge, h.hop.direction);
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
