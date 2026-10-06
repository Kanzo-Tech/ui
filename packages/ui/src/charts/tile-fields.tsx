"use client";

import type React from "react";
import { useMemo } from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { ChartColumnIcon, GaugeIcon, Rows3Icon, type LucideIcon } from "lucide-react";
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
} from "../simples/listbox.js";
import { RadioGroup, RadioGroupCard, RadioGroupLabel } from "../simples/radio-group.js";
import { CHART_TYPE } from "./chart-card.js";
import {
  DASHBOARD_CHART_TYPES,
  channelFields,
  normalizeCard,
  trendFields,
  type ChartTile,
  type DashboardChartType,
  type StatTile,
  type Tile,
  type TileKind,
} from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { MeasurePick, NONE, Pick, fieldOptions } from "./tile-controls.js";

/**
 * **How each kind of tile is edited** — its name, icon and hint in the kind picker, and the fields
 * its editor asks for. One row per kind, mapped over `TileKind` like `KINDS` and `TILE_VIEWS`. The
 * editor's code: `Dashboard` reaches it only through a lazy import, so a read-only dashboard never
 * loads it.
 */

/** What a kind's editor fields are handed: the draft, and where its next value goes. */
export interface TileFieldsProps<T extends Tile> {
  tile: T;
  fields: readonly FieldStat[];
  onChange: (tile: Tile) => void;
}

export interface TileEditorRow<T extends Tile> {
  label: string;
  icon: LucideIcon;
  hint: string;
  Fields: (props: TileFieldsProps<T>) => React.ReactNode;
}

type Editors = { [K in TileKind]: TileEditorRow<Extract<Tile, { kind: K }>> };

function ChartFields({ tile, fields, onChange }: TileFieldsProps<ChartTile>) {
  // A written title describes the encodings it was written for; changing them retires it.
  const set = (next: ChartTile) => {
    const valid = normalizeCard({ ...next, title: undefined }, fields);
    if (valid) onChange(valid);
  };
  const optional = (channel: "color" | "facet") => [
    { value: NONE, label: "None" },
    ...fieldOptions(channelFields(tile.type, channel, fields).filter((f) => f.name !== tile.x)),
  ];
  const rows = tile.type === "dot" || tile.type === "regression";

  return (
    <>
      <RadioGroup columns={3} onValueChange={(d) => d.value && set({ ...tile, type: d.value as DashboardChartType })} value={tile.type}>
        <RadioGroupLabel className="col-span-full text-xs">Mark</RadioGroupLabel>
        {DASHBOARD_CHART_TYPES.map((type) => {
          const { label, icon: Icon } = CHART_TYPE[type];
          return (
            <RadioGroupCard
              className="items-center py-2"
              disabled={normalizeCard({ ...tile, type }, fields) === null}
              key={type}
              value={type}
            >
              <Icon className="size-4" />
              <span className="text-xs">{label}</span>
            </RadioGroupCard>
          );
        })}
      </RadioGroup>
      <div className="grid grid-cols-2 gap-2">
        <Pick
          label={rows ? "X" : tile.type === "bar" ? "Group by" : "Along"}
          onChange={(x) => set({ ...tile, x })}
          options={fieldOptions(channelFields(tile.type, "x", fields))}
          value={tile.x}
        />
        {rows ? (
          <Pick
            label="Y"
            onChange={(field) => set({ ...tile, y: { op: "value", field } })}
            options={fieldOptions(channelFields(tile.type, "y", fields).filter((f) => f.name !== tile.x))}
            value={tile.y.field ?? ""}
          />
        ) : null}
      </div>
      {rows ? null : <MeasurePick fields={fields} measure={tile.y} onChange={(y) => set({ ...tile, y })} />}
      <div className="grid grid-cols-2 gap-2">
        {optional("color").length > 1 ? (
          <Pick
            label="Series"
            onChange={(color) => set({ ...tile, color: color === NONE ? undefined : color })}
            options={optional("color")}
            value={tile.color ?? NONE}
          />
        ) : null}
        {optional("facet").length > 1 ? (
          <Pick
            label="Split into panels"
            onChange={(facet) => set({ ...tile, facet: facet === NONE ? undefined : facet })}
            options={optional("facet")}
            value={tile.facet ?? NONE}
          />
        ) : null}
      </div>
    </>
  );
}

function StatFields({ tile, fields, onChange }: TileFieldsProps<StatTile>) {
  return (
    <>
      <MeasurePick fields={fields} measure={tile.measure} onChange={(measure) => onChange({ ...tile, measure })} />
      <Pick
        label="Trend along"
        onChange={(value) => onChange({ ...tile, trend: value === NONE ? undefined : value })}
        options={[{ value: NONE, label: "None" }, ...fieldOptions(trendFields(fields))]}
        value={tile.trend ?? NONE}
      />
    </>
  );
}

/** The fields as a multiple choice; a newly ticked column goes last, so the order is the reader's. */
function ColumnsPick({
  columns,
  fields,
  onChange,
}: {
  columns: readonly string[];
  fields: readonly FieldStat[];
  onChange: (columns: string[]) => void;
}) {
  const collection = useMemo(
    () => createListCollection({ items: fields.map((f) => f.name), itemToValue: (name) => name, itemToString: (name) => name }),
    [fields],
  );
  return (
    <Listbox
      collection={collection}
      onValueChange={(d) => onChange([...columns.filter((c) => d.value.includes(c)), ...d.value.filter((c) => !columns.includes(c))])}
      selectionMode="multiple"
      value={[...columns]}
    >
      <ListboxLabel className="text-xs">Columns</ListboxLabel>
      <ListboxContent className="max-h-56 overflow-y-auto rounded-field border p-1">
        {collection.items.map((name) => (
          <ListboxItem item={name} key={name}>
            <ListboxItemText>{name}</ListboxItemText>
            <ListboxItemIndicator />
          </ListboxItem>
        ))}
      </ListboxContent>
    </Listbox>
  );
}

export const TILE_EDITORS: Editors = {
  stat: { label: "Figure", icon: GaugeIcon, hint: "One number and its trend", Fields: StatFields },
  chart: { label: "Chart", icon: ChartColumnIcon, hint: "A measure by a field", Fields: ChartFields },
  table: {
    label: "Table",
    icon: Rows3Icon,
    hint: "The rows, as columns",
    Fields: ({ tile, fields, onChange }) => (
      <ColumnsPick columns={tile.columns} fields={fields} onChange={(columns) => onChange({ ...tile, columns })} />
    ),
  },
};

/** The editor fields of a tile of any kind. */
export function TileFields(props: TileFieldsProps<Tile>) {
  const { Fields } = TILE_EDITORS[props.tile.kind] as TileEditorRow<Tile>;
  return <Fields {...props} />;
}
