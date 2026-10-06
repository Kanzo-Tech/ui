"use client";

import { cn, PreferencesSections, useKanzoTheme } from "@kanzo-tech/ui";
import { useId } from "react";
import type { Channels } from "../core/channels";
import { lookFrom, type Look } from "../render/graph-looks";
import { scaleOf } from "../render/graph-model";
import { GRAPH_SECTION } from "../section";
import { ShapeGlyph } from "./shape-glyph";

export type GraphLooksProps = React.ComponentProps<"div">;

const NAMESPACE = GRAPH_SECTION.namespace;

/**
 * What the previews draw with: the categorical scale over the preview's ranks, and one ink for the
 * links. Neutral on purpose — the channels a canvas binds are its host's, and a preview that guessed
 * them would promise a picture the canvas might not paint.
 */
const PREVIEW: Channels = { stroke: "var(--muted-foreground)" };

/** The axes, in reading order; the forces are a live layout's and are not the picture. */
const AXES = ["marks", "edges", "additive-links", "labels", "grid", "vignette"] as const;

/**
 * One small graph — the same seven vertices and eight edges on every card, so every pixel that differs
 * comes from the look. Glyphs are `ShapeGlyph` and colours `scaleOf`, the canvas's own, so a card
 * cannot promise a picture the canvas does not paint.
 */
const NODES = [
  { x: 22, y: 20, rank: 0, ramp: 1 },
  { x: 58, y: 8, rank: 1, ramp: 0.3 },
  { x: 58, y: 32, rank: 1, ramp: 0.3 },
  { x: 98, y: 20, rank: 2, ramp: 0.7 },
  { x: 140, y: 10, rank: 3, ramp: 0.45 },
  { x: 140, y: 31, rank: 2, ramp: 0.2 },
  { x: 184, y: 21, rank: 0, ramp: 0.85 },
] as const;

const EDGES = [
  [0, 1],
  [0, 2],
  [1, 2],
  [0, 3],
  [3, 4],
  [3, 5],
  [4, 6],
  [5, 6],
] as const;

/** Screen pixels to the card's units, one factor for every look: Ink's larger floor is the look. */
const SCALE = 0.55;

function LookPreview({ channels, className, look }: { channels: Channels; className?: string; look: Look }) {
  const id = useId();
  const scale = scaleOf(channels);
  const radius = (ramp: number) => (look.size[0] + ramp * (look.size[1] - look.size[0])) * SCALE;
  return (
    <svg
      aria-hidden
      className={cn("h-16 w-full rounded-[4px] border bg-background", className)}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 208 40"
    >
      {(look.link.render ? EDGES : []).map(([from, to]) => {
        const a = NODES[from];
        const b = NODES[to];
        // cosmos.gl bows a link by a fraction of its length: the midpoint pushed along the perpendicular.
        const cx = (a.x + b.x) / 2 - (b.y - a.y) * look.link.curve;
        const cy = (a.y + b.y) / 2 + (b.x - a.x) * look.link.curve;
        return (
          <path
            d={`M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`}
            fill="none"
            key={`${from}-${to}`}
            stroke={channels.stroke ?? scale.color(a.rank)}
            strokeOpacity={look.link.opacity}
            strokeWidth={look.link.width}
          />
        );
      })}
      {NODES.map((node, i) => {
        const r = radius(node.ramp);
        return (
          <ShapeGlyph
            color={scale.color(node.rank)}
            height={r * 2}
            key={i}
            shape={scale.shape(node.rank)}
            width={r * 2}
            x={node.x - r}
            y={node.y - r}
          />
        );
      })}
      {look.vignette ? (
        <>
          <defs>
            <radialGradient id={id}>
              <stop offset="55%" stopColor="var(--background)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--background)" stopOpacity="0.85" />
            </radialGradient>
          </defs>
          <rect fill={`url(#${id})`} height="40" width="208" />
        </>
      ) : null}
    </svg>
  );
}

/**
 * **The graph's picture, as its axes** — Cosmograph's configuration and Gephi Lite's appearance
 * panel, which offer the axes alone with good defaults. Every axis is `GRAPH_SECTION`'s own control,
 * drawn by `PreferencesSections`: a choice is a row of cards, and Marks and Edges carry a preview —
 * the same small graph with that one option changed — the rest are switches. Additive links is drawn
 * only while there are links to add.
 *
 * Under `KanzoThemeProvider` with `GRAPH_SECTION` among its `sections` — without it there is nothing
 * to write and it draws nothing, as `PreferencesSections` does for an unknown namespace. It needs no
 * `GraphRoot`, so it sits in a preferences panel as well as in a dock.
 */
export function GraphLooks({ className, slot, ...rest }: GraphLooksProps) {
  const { sectionPrefs } = useKanzoTheme();
  const prefs = sectionPrefs[NAMESPACE];
  if (!prefs) return null;
  const values = Object.fromEntries(Object.entries(prefs).map(([key, pref]) => [key, pref.value]));
  const specimen = (key: string) => (option: { value: string }) => (
    <LookPreview channels={PREVIEW} className="h-10" look={lookFrom({ ...values, [key]: option.value })} />
  );

  return (
    <div {...rest} className={cn("flex flex-col gap-4", className)} data-slot={slot ?? "graph-looks"}>
      <PreferencesSections
        namespace={NAMESPACE}
        only={values.edges === "hidden" ? AXES.filter((key) => key !== "additive-links") : AXES}
        specimens={{ [`${NAMESPACE}.marks`]: specimen("marks"), [`${NAMESPACE}.edges`]: specimen("edges") }}
      />
    </div>
  );
}
