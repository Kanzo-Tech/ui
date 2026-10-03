"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "../simples/button.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { RadioGroup, RadioGroupCard, RadioGroupLabel } from "../simples/radio-group.js";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "../simples/sheet.js";
import type { ChartConfig } from "./chart-config.js";
import { changeKind, tileTitle, type Tile, type TileKind, type TileSpan } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { Pick } from "./tile-controls.js";
import { TILE_KINDS, TileFields, TileView } from "./tile-kinds.js";

const WIDTHS = [
  { value: "1", label: "A third" },
  { value: "2", label: "Two thirds" },
  { value: "3", label: "Full" },
];

export interface TileEditorProps {
  /** The relation the preview reads. */
  table: TableExpr;
  fields: readonly FieldStat[];
  /** The tile to edit — or to add, when `tiles` does not hold it; `null` closes the editor. */
  tile: Tile | null;
  /** The dashboard's tiles: where the tile sits, and what a change of kind prefers not to repeat. */
  tiles?: readonly Tile[];
  config?: Readonly<Record<string, ChartConfig>>;
  /** Called with the edited tile and the place it goes among `tiles`. */
  onSave: (tile: Tile, index: number) => void;
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * **The one tile editor** — Grafana's panel editor in a side sheet: the kind as cards, the fields
 * that kind reads, the width, and a live preview of the draft under the page's crossfilter. Adding
 * and editing open the same sheet, and nothing reaches the dashboard until *Add* or *Save*.
 */
export function TileEditor(props: TileEditorProps) {
  const { tile, onClose } = props;
  return (
    <Sheet lazyMount onOpenChange={(d) => !d.open && onClose()} open={tile !== null} unmountOnExit>
      <SheetContent className="max-w-xl">{tile ? <Draft key={tile.id} {...props} tile={tile} /> : null}</SheetContent>
    </Sheet>
  );
}

function Draft({ table, fields, tile, tiles = [], config, onSave, onRemove, onClose }: TileEditorProps & { tile: Tile }) {
  const at = tiles.findIndex((t) => t.id === tile.id);
  const adding = at === -1;
  const places = tiles.length + (adding ? 1 : 0);
  const [draft, setDraft] = useState<Tile>(tile);
  const [index, setIndex] = useState(adding ? tiles.length : at);
  const others = tiles.filter((t) => t.id !== tile.id);

  return (
    <>
      <SheetHeader description="What the tile shows, and how wide it is." title={adding ? "Add tile" : "Edit tile"} />
      <SheetBody className="flex flex-col gap-5">
        <RadioGroup
          columns={3}
          onValueChange={(d) => {
            const next = d.value ? changeKind(draft, d.value as TileKind, fields, others) : null;
            if (next) setDraft(next);
          }}
          value={draft.kind}
        >
          <RadioGroupLabel className="col-span-full text-xs">Kind</RadioGroupLabel>
          {(Object.keys(TILE_KINDS) as TileKind[]).map((kind) => {
            const { label, icon: Icon, hint } = TILE_KINDS[kind];
            return (
              <RadioGroupCard
                className="flex-col"
                disabled={changeKind(draft, kind, fields, others) === null}
                key={kind}
                value={kind}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">{label}</span>
                <span className="text-muted-foreground text-xs">{hint}</span>
              </RadioGroupCard>
            );
          })}
        </RadioGroup>

        <TileFields fields={fields} onChange={setDraft} tile={draft} />

        <Field className="gap-1">
          <FieldLabel className="text-xs">Title</FieldLabel>
          <Input
            onChange={(event) => setDraft({ ...draft, title: event.target.value || undefined })}
            placeholder={tileTitle({ ...draft, title: undefined })}
            size="sm"
            value={draft.title ?? ""}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <RadioGroup
            className="gap-2"
            columns={3}
            onValueChange={(d) => d.value && setDraft({ ...draft, span: Number(d.value) as TileSpan })}
            value={String(draft.span)}
          >
            <RadioGroupLabel className="col-span-full text-xs">Width</RadioGroupLabel>
            {WIDTHS.map((w) => (
              <RadioGroupCard className="justify-center py-1.5 text-xs" key={w.value} value={w.value}>
                {w.label}
              </RadioGroupCard>
            ))}
          </RadioGroup>
          {places > 1 ? (
            <Pick
              label="Position"
              onChange={(value) => setIndex(Number(value))}
              options={Array.from({ length: places }, (_, i) => ({ value: String(i), label: String(i + 1) }))}
              value={String(index)}
            />
          ) : null}
        </div>

        <section aria-label="Preview" className="flex flex-col gap-1.5">
          <span className="font-medium text-muted-foreground text-xs">Preview</span>
          <TileView config={config} fields={fields} table={table} tile={draft} />
        </section>
      </SheetBody>
      <SheetFooter>
        {onRemove && !adding ? (
          <Button className="me-auto" onClick={onRemove} variant="ghost">
            <Trash2Icon />
            Remove
          </Button>
        ) : null}
        <Button onClick={onClose} variant="ghost">
          Cancel
        </Button>
        <Button onClick={() => onSave(draft, index)}>{adding ? "Add" : "Save"}</Button>
      </SheetFooter>
    </>
  );
}
