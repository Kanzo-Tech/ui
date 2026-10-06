"use client";

import { relationHops, relationKey, type JoinGraph, type Relation } from "@kanzo-tech/mosaic";
import { useMemo } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { createListCollection } from "@ark-ui/react/collection";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";

export interface RelationPickerProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The types and the edges between them. */
  graph: JoinGraph;
  value: Relation;
  onValueChange: (relation: Relation) => void;
}

/**
 * **A relation, picked as a path** — Looker's explore picker: a root type, then any number of hops,
 * each an edge to the type at its other end. Picking another root starts over; the last hop is the
 * one that can be taken back. A type on its own is the relation with no hops, so there is no second
 * control for it.
 *
 * ARIA: a `group` named "Relation". The root is a `Select`, "Hop" a `Menu` of the edges leaving the
 * last type, and the remove button names the hop it takes back.
 */
export function RelationPicker(props: RelationPickerProps) {
  const { graph, value, onValueChange, className, slot, ...rest } = props;
  const roots = useMemo(
    () => createListCollection({ items: graph.types.map((t) => t.name), itemToValue: (n) => n, itemToString: (n) => n }),
    [graph],
  );
  // Each hop with the type it arrives at, read off the edges the way the relation walks them.
  const walked = value.path.map((hop, i) => {
    const edge = graph.edges.find((e) => e.name === hop.edge);
    return { hop, i, label: edge?.label ?? hop.edge, to: (hop.direction === "out" ? edge?.destination : edge?.source) ?? "" };
  });
  const last = walked.at(-1)?.to ?? value.root;
  const next = relationHops(graph, last);

  return (
    <ark.div
      aria-label="Relation"
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      role="group"
      {...rest}
      data-slot={slot ?? "relation-picker"}
    >
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
      {walked.map(({ hop, i, label, to }) => {
        const Arrow = hop.direction === "out" ? ArrowRightIcon : ArrowLeftIcon;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm" data-slot="relation-picker-hop" key={i}>
            <Arrow aria-hidden className="size-3.5 text-muted-foreground rtl:rotate-180" />
            <span className="text-muted-foreground">{label}</span>
            <Arrow aria-hidden className="size-3.5 text-muted-foreground rtl:rotate-180" />
            <span className="font-medium">{to}</span>
          </span>
        );
      })}
      {walked.length > 0 ? (
        <Button
          aria-label={`Remove the hop to ${last}`}
          className="text-muted-foreground hover:text-foreground focus-visible:text-foreground"
          onClick={() => onValueChange({ root: value.root, path: value.path.slice(0, -1) })}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
      {next.length > 0 ? (
        <Menu positioning={{ placement: "bottom-start" }}>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <PlusIcon />
              Hop
            </Button>
          </MenuTrigger>
          <MenuContent>
            {next.map(({ hop, label, to }) => {
              const path = [...value.path, hop];
              return (
                <MenuItem
                  key={`${hop.direction}:${hop.edge}`}
                  onSelect={() => onValueChange({ root: value.root, path })}
                  value={relationKey(graph, { root: value.root, path })}
                >
                  {hop.direction === "out" ? `${label} → ${to}` : `← ${label} · ${to}`}
                </MenuItem>
              );
            })}
          </MenuContent>
        </Menu>
      ) : null}
    </ark.div>
  );
}
