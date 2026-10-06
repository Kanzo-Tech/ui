"use client";

import {
  cn,
  NativeSelect,
  NativeSelectOption,
  PreferencesFieldSet,
  RadioGroup,
  RadioGroupCard,
  RadioGroupText,
  Show,
} from "@kanzo-tech/ui";
import type { ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import type { Channels } from "../core/channels";
import type { Structure } from "../core/structure";
import { useGraphState } from "../react/use-graph-state";

type Placed = Pick<Channels, "x" | "y" | "cluster">;
type Mode = "force" | "map" | "clustered";

export interface GraphPlacementProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The placement channels the root is handed — the host's state, as `GraphRoot`'s props are. */
  value: Placed;
  onChange: (value: Placed) => void;
}

const MODES: Record<Mode, { label: string; blurb: string }> = {
  force: { label: "Force", blurb: "The layout places every point on the GPU, until it settles." },
  map: { label: "Map", blurb: "Two numeric columns place the points, and nothing simulates. Longitude and latitude draw a map, north up." },
  clustered: { label: "Clustered", blurb: "The layout runs, and points sharing a value of one column pull together." },
};

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
  const dots = DOTS[mode];
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

/** The manifest's numeric spellings — `fossil-sinks`' `data_type_name`. */
const NUMERIC = /^(u?int(8|16|32|64)|float|double|decimal)$/;

/** Every vertex table's fields, once each by name, sorted: all of them, and the numeric ones. */
function fieldsOf(structure: Structure | null): { any: string[]; numeric: string[] } {
  const any = new Set<string>();
  const numeric = new Set<string>();
  for (const table of structure?.vertices ?? []) {
    for (const [name, column] of table.columns) {
      if (column.role !== null) continue;
      any.add(name);
      if (NUMERIC.test(column.type)) numeric.add(name);
    }
  }
  return { any: [...any].sort(), numeric: [...numeric].sort() };
}

function Column({ columns, label, onChange, value }: { columns: string[]; label: string; onChange: (value?: string) => void; value?: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground text-xs">
      <label className="shrink-0" htmlFor={id}>
        {label}
      </label>
      <NativeSelect
        className="min-w-0 flex-1"
        id={id}
        onChange={(event) => onChange(event.target.value || undefined)}
        size="sm"
        value={value ?? ""}
      >
        <NativeSelectOption value="">Choose a column</NativeSelectOption>
        {columns.map((column) => (
          <NativeSelectOption key={column} value={column}>
            {column}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

/**
 * **Where the points come from: a row of three cards** — Force, Map and Clustered, Cosmograph's rule
 * that the data places the points or the layout does, with the cluster force as the third. Each card
 * is the mode's name over a small picture of what it does to a handful of points, the same control
 * `PreferencesSections` draws a choice with; one line under the row says what the checked mode does,
 * and its columns follow in one row: Map binds `x` and `y` over the numeric fields, Clustered binds
 * `cluster` over any. The fields are the attached corpus's own, from `fossil_columns`.
 *
 * Controlled: `value` is what the root is handed, so a half-bound Map — one column of two — is a
 * running layout until the second is chosen, which the row says. The card a reader picks before
 * binding anything is held here, since `{}` alone cannot tell Force from an empty Map.
 *
 * **The selects are the cards' sibling, never their child.** Ark's card is the radio's `<label>`, its
 * whole box the radio's hit area: a select inside it sits in that hit area, so a click on the select's
 * own label or the gap around it lands on the radio, and a label holding a second control is invalid
 * HTML. Ark's and shadcn's choice cards keep a card to its title for the same reason; the settings it
 * reveals follow the group, named after the card.
 *
 * ARIA: Ark's radio group, one radio per card, named by the card's title alone; the checked card's
 * columns are a `group` named "<card> columns", their selects native with a real `<label>` each,
 * reached by Tab after the group — the arrow keys stay the group's.
 */
export function GraphPlacement({ className, onChange, slot, value, ...rest }: GraphPlacementProps) {
  const structure = useGraphState((s) => s.structure);
  const fields = useMemo(() => fieldsOf(structure), [structure]);
  const [picked, setPicked] = useState<Mode>("force");
  const mode: Mode = value.x || value.y ? "map" : value.cluster ? "clustered" : picked;
  const half = Boolean(value.x) !== Boolean(value.y);

  return (
    <div {...rest} className={cn("flex flex-col gap-4", className)} data-slot={slot ?? "graph-placement"}>
      <PreferencesFieldSet label="Placement">
        <RadioGroup
          className="flex-row flex-wrap gap-2"
          onValueChange={(details) => {
            if (!details.value) return;
            setPicked(details.value as Mode);
            onChange({});
          }}
          value={mode}
        >
          {(Object.keys(MODES) as Mode[]).map((id) => (
            <RadioGroupCard className="min-w-0 flex-1 basis-16 flex-col items-center gap-1 px-2 py-2" key={id} value={id}>
              <ModePreview mode={id} />
              <RadioGroupText className="w-full truncate text-center text-xs">{MODES[id].label}</RadioGroupText>
            </RadioGroupCard>
          ))}
        </RadioGroup>
        <p className="text-muted-foreground text-xs leading-relaxed">{MODES[mode].blurb}</p>
        <Show when={mode === "map"}>
          <div aria-label={`${MODES.map.label} columns`} className="flex flex-col gap-1.5" role="group">
            <div className="flex gap-3">
              <Column columns={fields.numeric} label="x" onChange={(x) => onChange({ x, y: value.y })} value={value.x} />
              <Column columns={fields.numeric} label="y" onChange={(y) => onChange({ x: value.x, y })} value={value.y} />
            </div>
            <Show when={half}>
              <span className="text-muted-foreground text-xs">Choose both to place by data; until then the layout runs.</span>
            </Show>
          </div>
        </Show>
        <Show when={mode === "clustered"}>
          <div aria-label={`${MODES.clustered.label} columns`} className="flex" role="group">
            <Column columns={fields.any} label="cluster" onChange={(cluster) => onChange({ cluster })} value={value.cluster} />
          </div>
        </Show>
      </PreferencesFieldSet>
    </div>
  );
}
