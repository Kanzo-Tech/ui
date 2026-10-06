"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "../simples/button.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { Popover, PopoverAnchor, PopoverBody, PopoverContent, PopoverFooter, PopoverHeader } from "../simples/popover.js";
import { SegmentGroup } from "../simples/segment-group.js";
import type { ChartConfig } from "./chart-config.js";
import type { Tile, TileKind, TileSpan } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { Pick } from "./tile-controls.js";
import { TILE_EDITORS, TileFields } from "./tile-fields.js";
import { changeKind, tileTitle } from "./tile-kinds.js";
import { TileView, tileSpan } from "./tile-views.js";

const WIDTHS = [
  { value: "1", label: "A third" },
  { value: "2", label: "Two thirds" },
  { value: "3", label: "Full" },
];

export interface TileEditorProps {
  /** The relation the tile reads. */
  table: TableExpr;
  fields: readonly FieldStat[];
  /** The tile to edit — or to add, when `tiles` does not hold it. Mounted is open. */
  tile: Tile;
  /** The dashboard's tiles: where the tile sits, and what a change of kind prefers not to repeat. */
  tiles?: readonly Tile[];
  config?: Readonly<Record<string, ChartConfig>>;
  /** Called with the edited tile and the place it goes among `tiles`. */
  onSave: (tile: Tile, index: number) => void;
  onRemove?: () => void;
  /** Cancel, Escape and a click outside: the draft is dropped. */
  onClose: () => void;
}

/**
 * **The one tile editor** — a popover anchored to the tile it edits, the way Notion and Linear edit a
 * block where it sits. The tile in the grid *is* the preview: it draws the draft under the page's
 * crossfilter, and grows or shrinks as the width changes. Adding and editing are the same popover,
 * and nothing reaches the dashboard until *Add* or *Save*; a new position applies on save, so the
 * tile does not move under the popover.
 *
 * Render it where the tile goes, in place of the tile's view: it draws the tile itself.
 */
export function TileEditor({ table, fields, tile, tiles = [], config, onSave, onRemove, onClose }: TileEditorProps) {
  const at = tiles.findIndex((t) => t.id === tile.id);
  const adding = at === -1;
  const places = tiles.length + (adding ? 1 : 0);
  const [draft, setDraft] = useState<Tile>(tile);
  const [index, setIndex] = useState(adding ? tiles.length : at);
  const others = tiles.filter((t) => t.id !== tile.id);
  const kinds = (Object.keys(TILE_EDITORS) as TileKind[]).map((kind) => {
    const { label, icon: Icon } = TILE_EDITORS[kind];
    return {
      value: kind,
      label: (
        <>
          <Icon className="size-4" />
          {label}
        </>
      ),
      disabled: changeKind(draft, kind, fields, others) === null,
    };
  });

  return (
    <Popover onOpenChange={(d) => !d.open && onClose()} open positioning={{ placement: "bottom-start", gutter: 8 }}>
      <PopoverAnchor className={tileSpan(draft.span)}>
        <TileView config={config} fields={fields} table={table} tile={draft} />
      </PopoverAnchor>
      <PopoverContent className="max-h-(--available-height) w-[min(28rem,calc(100vw-2rem))]">
        <PopoverHeader description={TILE_EDITORS[draft.kind].hint} title={adding ? "Add tile" : "Edit tile"} />
        <PopoverBody className="flex flex-col gap-4">
          <SegmentGroup
            aria-label="Kind"
            onValueChange={(d) => {
              const next = d.value ? changeKind(draft, d.value as TileKind, fields, others) : null;
              if (next) setDraft(next);
            }}
            options={kinds}
            size="sm"
            value={draft.kind}
            variant="solid"
          />

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
            <Field className="gap-1">
              <FieldLabel className="text-xs">Width</FieldLabel>
              <SegmentGroup
                onValueChange={(d) => d.value && setDraft({ ...draft, span: Number(d.value) as TileSpan })}
                options={WIDTHS}
                size="sm"
                value={String(draft.span)}
                variant="solid"
              />
            </Field>
            {places > 1 ? (
              <Pick
                label="Position"
                onChange={(value) => setIndex(Number(value))}
                options={Array.from({ length: places }, (_, i) => ({ value: String(i), label: String(i + 1) }))}
                value={String(index)}
              />
            ) : null}
          </div>
        </PopoverBody>
        <PopoverFooter>
          {onRemove && !adding ? (
            <Button className="me-auto" onClick={onRemove} size="sm" variant="ghost">
              <Trash2Icon />
              Remove
            </Button>
          ) : null}
          <Button onClick={onClose} size="sm" variant="ghost">
            Cancel
          </Button>
          <Button onClick={() => onSave(draft, index)} size="sm">
            {adding ? "Add" : "Save"}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
