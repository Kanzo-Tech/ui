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
import { useId, useMemo, useState } from "react";
import type { Channels } from "../core/channels";
import type { Structure } from "../core/source";
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
  map: { label: "Map", blurb: "Two numeric columns place the points and nothing simulates. Longitude and latitude draw a map, north up." },
  clustered: { label: "Clustered", blurb: "The layout runs, and points sharing a value of one column pull together." },
};

/** The manifest's numeric spellings — `fossil-sinks`' `data_type_name`. */
const NUMERIC = /^(u?int(8|16|32|64)|float|double|decimal)$/;

/** Every vertex table's fields, once each by name, sorted: all of them, and the numeric ones. */
function fieldsOf(structure: Structure | null): { any: string[]; numeric: string[] } {
  const any = new Set<string>();
  const numeric = new Set<string>();
  for (const table of structure?.vertices ?? []) {
    for (const [name, type] of table.fields) {
      any.add(name);
      if (NUMERIC.test(type)) numeric.add(name);
    }
  }
  return { any: [...any].sort(), numeric: [...numeric].sort() };
}

function Column({ columns, label, onChange, value }: { columns: string[]; label: string; onChange: (value?: string) => void; value?: string }) {
  const id = useId();
  // A `div` and `aria-labelledby`, not a `<label>`: the card around it is already the radio's label,
  // and a label inside a label is invalid and names the radio by the select's text.
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className="w-12 shrink-0" id={id}>
        {label}
      </span>
      <NativeSelect
        aria-labelledby={id}
        className="min-w-0 flex-1"
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
 * **Where the points come from, as three cards** — Force, Map and Clustered, Cosmograph's rule that
 * the data places the points or the layout does, with the cluster force as the third. The column
 * selects live in the checked card only: Map binds `x` and `y` over the numeric fields, Clustered
 * binds `cluster` over any. The fields are the attached corpus's own, from `fossil_columns`.
 *
 * Controlled: `value` is what the root is handed, so a half-bound Map — one column of two — is a
 * running layout until the second is chosen, which the card says. The card a reader picks before
 * binding anything is held here, since `{}` alone cannot tell Force from an empty Map.
 *
 * ARIA: Ark's radio group, one radio per card, named by the card's title alone; the selects inside
 * are native, each named by its visible label, and leave the radio's arrow keys to the group.
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
          onValueChange={(details) => {
            if (!details.value) return;
            setPicked(details.value as Mode);
            onChange({});
          }}
          value={mode}
        >
          {(Object.keys(MODES) as Mode[]).map((id) => (
            <RadioGroupCard className="flex-col items-stretch gap-1 p-2.5" key={id} value={id}>
              <RadioGroupText className="font-medium text-xs">{MODES[id].label}</RadioGroupText>
              <span className="text-[10px] text-muted-foreground leading-relaxed">{MODES[id].blurb}</span>
              <Show when={mode === id && id === "map"}>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <Column columns={fields.numeric} label="x" onChange={(x) => onChange({ x, y: value.y })} value={value.x} />
                  <Column columns={fields.numeric} label="y" onChange={(y) => onChange({ x: value.x, y })} value={value.y} />
                  <Show when={half}>
                    <span className="text-[10px] text-muted-foreground">Choose both to place by data; until then the layout runs.</span>
                  </Show>
                </div>
              </Show>
              <Show when={mode === id && id === "clustered"}>
                <div className="mt-1.5">
                  <Column columns={fields.any} label="cluster" onChange={(cluster) => onChange({ cluster })} value={value.cluster} />
                </div>
              </Show>
            </RadioGroupCard>
          ))}
        </RadioGroup>
      </PreferencesFieldSet>
    </div>
  );
}
