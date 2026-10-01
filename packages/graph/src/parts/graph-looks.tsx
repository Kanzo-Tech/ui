"use client";

import {
  Button,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  PreferencesFieldSet,
  PreferencesSections,
  RadioGroup,
  RadioGroupCard,
  SegmentGroup,
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
  nebula: { label: "Nebula", blurb: "Dense, dim points and additive links: a picture that reads as flow.", channels: {} },
  atlas: {
    label: "Atlas",
    blurb: "Map-steady points, links that just bow, generous labels.",
    channels: { stroke: "var(--muted-foreground)" },
  },
  ink: {
    label: "Ink",
    blurb: "Large, legible marks in one ink, identity on shape — the print-and-projector register.",
    channels: { fill: "var(--foreground)", symbol: "category", stroke: "var(--muted-foreground)" },
  },
};

/** The axes under "Customize", after Marks; the forces are a live layout's and are not the picture. */
const CUSTOMIZE = ["links", "labels", "additive-links", "bowed-links", "vignette", "grid"] as const;

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

function LookPreview({ channels, look }: { channels: Channels; look: Look }) {
  const id = useId();
  const scale = scaleOf(channels);
  const radius = (ramp: number) => (look.size[0] + ramp * (look.size[1] - look.size[0])) * SCALE;
  return (
    <svg aria-hidden className="h-16 w-full rounded-[4px] border bg-background" preserveAspectRatio="xMidYMid meet" viewBox="0 0 208 40">
      {EDGES.map(([from, to]) => {
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
 * **The graph's picture, as three looks and the axes under them** — GitHub's appearance settings:
 * pick by looking, then customise. The looks are `PRESETS` over `GRAPH_SECTION`'s axes; wearing one
 * writes every axis it names, and a look is checked exactly when the resolved axes are its own, so
 * there is no name stored beside them to go stale. "Customize" holds the axes themselves — Marks as
 * a segmented control, the rest as the section declares them — and opens on its own when the axes
 * are no preset.
 *
 * Under `KanzoThemeProvider` with `GRAPH_SECTION` among its `sections` — without it there is nothing
 * to write and it draws nothing, as `PreferencesSections` does for an unknown namespace. It needs no
 * `GraphRoot`, so it sits in a preferences panel as well as in a dock. A look whose axes a tenant pinned is disabled,
 * because wearing it would change nothing.
 */
export function GraphLooks({ className, slot, ...rest }: GraphLooksProps) {
  const { sectionPrefs, setSectionPref } = useKanzoTheme();
  const { preset } = useGraphPrefs();
  const prefs = sectionPrefs[NAMESPACE];
  if (!prefs) return null;
  const offered = (key: string) => prefs[key]?.offered === true;
  const marks = prefs.marks;
  const options = marks?.decl.kind === "choice" && Array.isArray(marks.decl.options) ? marks.decl.options : [];

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
      </PreferencesFieldSet>

      <Collapsible defaultOpen={preset === null}>
        <CollapsibleTrigger asChild>
          <Button className="w-full" size="sm" variant="ghost">
            Customize
            <Show when={preset === null}>
              <span className="ms-auto me-1 font-normal text-muted-foreground text-xs">Custom</span>
            </Show>
            <CollapsibleIndicator />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-3">
          <Show when={offered("marks")}>
            <PreferencesFieldSet label={marks?.decl.label ?? "Marks"}>
              <SegmentGroup
                onValueChange={(details) => details.value && setSectionPref(NAMESPACE, { marks: details.value })}
                options={options}
                size="sm"
                value={marks?.value ?? null}
                variant="solid"
              />
            </PreferencesFieldSet>
          </Show>
          <PreferencesSections namespace={NAMESPACE} only={CUSTOMIZE} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
