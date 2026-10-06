"use client";

import { cn, SectionProvider, useKanzoTheme, type PrefSpecimen } from "@kanzo-tech/ui";
import { type ReactNode, useId, useMemo } from "react";
import type { Channels } from "../core/channels";
import type { Structure } from "../core/structure";
import { lookFrom, type Look } from "../render/graph-looks";
import { scaleOf } from "../render/graph-model";
import { useGraphState } from "../react/use-graph-state";
import { ShapeGlyph } from "./shape-glyph";

type PrefOption = Parameters<PrefSpecimen>[0];

/**
 * **What only the graph knows about its section** — the columns of the corpus it attached, and a
 * picture for each option a person picks by looking.
 *
 * `GRAPH_SECTION` says what may be set; a manifest is data, so it cannot know a corpus or draw a
 * mark. The root can, and it says so the way every section's owner does: a `SectionProvider` over
 * its subtree, which is how a `<Pref>` anywhere beneath — or `PreferencesSections namespace="graph"`
 * — draws the whole control with no host passing a list it does not own. The theme provider does the
 * same for the core's themes.
 */
export function GraphSection({ children }: { children?: ReactNode }) {
  const structure = useGraphState((s) => s.structure);
  const sources = useMemo(() => fieldsOf(structure), [structure]);
  return (
    <SectionProvider namespace="graph" sources={sources} specimens={SPECIMENS}>
      {children}
    </SectionProvider>
  );
}

/** The manifest's numeric spellings — `fossil-sinks`' `data_type_name`. */
const NUMERIC = /^(u?int(8|16|32|64)|float|double|decimal)$/;

/** Every vertex table's fields, once each by name, sorted: all of them, and the numeric ones. */
function fieldsOf(structure: Structure | null): { columns: PrefOption[]; "numeric-columns": PrefOption[] } {
  const any = new Set<string>();
  const numeric = new Set<string>();
  for (const table of structure?.vertices ?? []) {
    for (const [name, column] of table.columns) {
      if (column.role !== null) continue;
      any.add(name);
      if (NUMERIC.test(column.type)) numeric.add(name);
    }
  }
  const options = (names: Set<string>) => [...names].sort().map((name) => ({ value: name, label: name }));
  return { columns: options(any), "numeric-columns": options(numeric) };
}

/**
 * What the previews draw with: the categorical scale over the preview's ranks, and one ink for the
 * links. Neutral on purpose — the channels a canvas binds are its host's, and a preview that guessed
 * them would promise a picture the canvas might not paint.
 */
const PREVIEW: Channels = { stroke: "var(--muted-foreground)" };

/**
 * The small graph with ONE axis changed — the current picture, every other axis as the reader set
 * it, so a card shows what picking it would do rather than a picture nobody is looking at.
 */
function AxisPreview({ axis, value }: { axis: string; value: string }) {
  // A specimen is drawn by a `<Pref>`, which is only ever under the theme provider.
  const prefs = useKanzoTheme().sectionPrefs.graph ?? {};
  const values = Object.fromEntries(Object.entries(prefs).map(([key, pref]) => [key, pref.value]));
  return <LookPreview channels={PREVIEW} className="h-10" look={lookFrom({ ...values, [axis]: value })} />;
}

const SPECIMENS: Readonly<Record<string, PrefSpecimen>> = {
  marks: (option) => <AxisPreview axis="marks" value={option.value} />,
  edges: (option) => <AxisPreview axis="edges" value={option.value} />,
  placement: (option) => <ModePreview mode={option.value as Mode} />,
};

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

type Mode = "force" | "map" | "clustered";

/**
 * What each mode does to a handful of points, drawn small — the same register as the look's previews.
 * Points in `currentColor`, so the card's own text colour is the ink and a checked card needs nothing.
 */
const DOTS: Record<Mode, readonly (readonly [number, number])[]> = {
  force: [[10, 12], [22, 6], [24, 18], [36, 11], [48, 5], [50, 19]],
  map: [[12, 18], [20, 10], [28, 14], [36, 6], [44, 16], [52, 9]],
  clustered: [[10, 8], [15, 15], [19, 9], [44, 9], [49, 16], [53, 8]],
};
const LINKS: readonly (readonly [number, number])[] = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]];

function ModePreview({ mode }: { mode: Mode }) {
  const dots = DOTS[mode] ?? DOTS.force;
  let under: ReactNode = null;
  if (mode === "force") {
    under = LINKS.map(([a, b]) => (
      <line key={`${a}-${b}`} strokeOpacity={0.4} x1={dots[a]?.[0]} x2={dots[b]?.[0]} y1={dots[a]?.[1]} y2={dots[b]?.[1]} />
    ));
  } else if (mode === "map") {
    under = <path d="M4 22H60M4 22V2" strokeOpacity={0.4} />;
  } else {
    under = [
      <circle cx={15} cy={11} fill="none" key="a" r={9} strokeDasharray="2 2" strokeOpacity={0.4} />,
      <circle cx={49} cy={11} fill="none" key="b" r={9} strokeDasharray="2 2" strokeOpacity={0.4} />,
    ];
  }
  return (
    <svg aria-hidden className="h-6 w-full" preserveAspectRatio="xMidYMid meet" stroke="currentColor" viewBox="0 0 64 24">
      {under}
      {dots.map(([x, y]) => (
        <circle cx={x} cy={y} fill="currentColor" key={`${x}-${y}`} r={2} stroke="none" />
      ))}
    </svg>
  );
}
