"use client";

import {
  cn,
  PreferencesFieldSet,
  PreferencesSections,
  RadioGroup,
  RadioGroupCard,
  Show,
  useKanzoTheme,
} from "@kanzo-tech/ui";
import { useId } from "react";
import type { Channels } from "../core/channels";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { lookFrom, PRESETS, type Look, type LookPreset } from "../render/graph-looks";
import { scaleOf } from "../render/graph-model";
import { GRAPH_SECTION } from "../section";
import { ShapeGlyph } from "./shape-glyph";

export type GraphLooksProps = React.ComponentProps<"div">;

const NAMESPACE = GRAPH_SECTION.namespace;

const CARDS: Record<LookPreset, { label: string; blurb: string; channels: Channels }> = {
  nebula: { label: "Nebula", blurb: "Dense points and straight, additive links that read as flow; a name only under the pointer.", channels: {} },
  atlas: {
    label: "Atlas",
    blurb: "Map-steady points, links that just curve, the biggest points named.",
    channels: { stroke: "var(--muted-foreground)" },
  },
  ink: {
    label: "Ink",
    blurb: "Large, legible marks in one ink, identity on shape, names wherever you look — the print-and-projector register.",
    channels: { fill: "var(--foreground)", symbol: "category", stroke: "var(--muted-foreground)" },
  },
};

/** The axes under the looks, in reading order; the forces are a live layout's and are not the picture. */
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
 * **The graph's picture: three looks, and the axes under them, always in view** — GitHub's appearance
 * settings for the looks, Gephi Lite's appearance panel for the axes. The looks are `PRESETS` over
 * `GRAPH_SECTION`'s axes; wearing one writes every axis it names, and a look is checked exactly when
 * the resolved axes are its own, so there is no name stored beside them to go stale.
 *
 * The axes are the section's own controls, through `PreferencesSections`: Marks and Edges as cards
 * whose picture is the current look with that one option changed, Labels as a list, the rest as
 * switches. Additive links is drawn only while there are links to add.
 *
 * Under `KanzoThemeProvider` with `GRAPH_SECTION` among its `sections` — without it there is nothing
 * to write and it draws nothing, as `PreferencesSections` does for an unknown namespace. It needs no
 * `GraphRoot`, so it sits in a preferences panel as well as in a dock. A look whose axes a tenant
 * pinned is disabled, because wearing it would change nothing.
 */
export function GraphLooks({ className, slot, ...rest }: GraphLooksProps) {
  const { sectionPrefs, setSectionPref } = useKanzoTheme();
  const { preset } = useGraphPrefs();
  const prefs = sectionPrefs[NAMESPACE];
  if (!prefs) return null;
  const offered = (key: string) => prefs[key]?.offered === true;
  const values = Object.fromEntries(Object.entries(prefs).map(([key, pref]) => [key, pref.value]));
  const channels = CARDS[preset ?? "atlas"].channels;
  const specimen = (key: string) => (option: { value: string }) => (
    <LookPreview channels={channels} className="h-10" look={lookFrom({ ...values, [key]: option.value })} />
  );

  return (
    <div {...rest} className={cn("flex flex-col gap-4", className)} data-slot={slot ?? "graph-looks"}>
      <PreferencesFieldSet label="Look">
        <RadioGroup
          onValueChange={(details) => {
            const id = details.value as LookPreset | null;
            if (id) setSectionPref(NAMESPACE, PRESETS[id]);
          }}
          value={preset}
        >
          {(Object.keys(CARDS) as LookPreset[]).map((id) => (
            <RadioGroupCard
              className="flex-col gap-0 p-2"
              disabled={!Object.keys(PRESETS[id]).every(offered)}
              key={id}
              value={id}
            >
              <LookPreview channels={CARDS[id].channels} look={lookFrom(PRESETS[id])} />
              <span className="mt-1.5 font-medium text-xs">{CARDS[id].label}</span>
              <span className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{CARDS[id].blurb}</span>
            </RadioGroupCard>
          ))}
        </RadioGroup>
        <Show when={preset === null}>
          <p className="text-muted-foreground text-xs">Custom: the axes below are none of the three looks.</p>
        </Show>
      </PreferencesFieldSet>
      <PreferencesSections
        namespace={NAMESPACE}
        only={values.edges === "hidden" ? AXES.filter((key) => key !== "additive-links") : AXES}
        specimens={{ [`${NAMESPACE}.marks`]: specimen("marks"), [`${NAMESPACE}.edges`]: specimen("edges") }}
      />
    </div>
  );
}
