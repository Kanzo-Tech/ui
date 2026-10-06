"use client";

import { useEffect, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "../simples/button.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { Popover, PopoverBody, PopoverContent, PopoverFooter, PopoverHeader } from "../simples/popover.js";
import { RadioGroup, RadioGroupCard, RadioGroupLabel } from "../simples/radio-group.js";
import { SegmentGroup } from "../simples/segment-group.js";
import type { Tile, TileKind, TileSpan } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { Pick } from "./tile-controls.js";
import { TILE_EDITORS, TileFields } from "./tile-fields.js";
import { changeKind, inBand, peersOf, tileTitle } from "./tile-kinds.js";

const WIDTHS = [
  { value: "1", label: "A third" },
  { value: "2", label: "Two thirds" },
  { value: "3", label: "Full" },
];

export interface TileEditorProps {
  fields: readonly FieldStat[];
  /**
   * The draft — the tile to edit, or to add when `tiles` does not hold it. The host draws it in the
   * tile's slot, so the tile in the grid is the preview. Mounted is open.
   */
  tile: Tile;
  /** Every change to the draft. */
  onChange: (tile: Tile) => void;
  /** The tile's slot in the grid: the popover sits beside it, and opening brings it into view. */
  anchor: () => HTMLElement | null;
  /** The dashboard's tiles: where the tile sits, and what a change of kind prefers not to repeat. */
  tiles?: readonly Tile[];
  /** Called with the draft and its position among its peers — the figures, or the grid's tiles. */
  onSave: (tile: Tile, index: number) => void;
  onRemove?: () => void;
  /** Cancel, Escape and a click outside: the draft is dropped. */
  onClose: () => void;
}

/**
 * **The one tile editor** — a popover anchored to the tile it edits, the way Notion and Linear edit a
 * block where it sits. The tile in the grid *is* the preview: the host draws the draft in the tile's
 * slot under the page's crossfilter, so it grows or shrinks as the width changes. Adding and editing
 * are the same popover, and nothing reaches the dashboard until *Add* or *Save*; a new position
 * applies on save, so the tile does not move under the popover.
 *
 * The editor draws no tile. The host keeps its view mounted and hands the editor the slot through
 * `anchor`: a view that remounted on opening would rebuild its plot and query again.
 */
export function TileEditor({ fields, tile: draft, onChange: setDraft, anchor, tiles = [], onSave, onRemove, onClose }: TileEditorProps) {
  const adding = !tiles.some((t) => t.id === draft.id);
  // A position is among the tile's peers — the band of figures, or the grid — and a change of kind
  // that moves it to the other one puts it at the end there, until somebody picks another.
  const peers = peersOf(tiles, draft);
  const [placed, setPlaced] = useState(() => {
    const own = tiles.filter((t) => inBand(t) === inBand(draft)).findIndex((t) => t.id === draft.id);
    return { band: inBand(draft), position: own === -1 ? peers.length : own };
  });
  const position = placed.band === inBand(draft) ? placed.position : peers.length;
  const places = peers.length + 1;
  // A tile being added has its slot at the end of the grid, usually below the fold. Once, on opening:
  // `anchor` is a new function on every render of the host.
  useEffect(() => {
    anchor()?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const others = tiles.filter((t) => t.id !== draft.id);
  const kinds = Object.keys(TILE_EDITORS) as TileKind[];

  return (
    <Popover
      onOpenChange={(d) => !d.open && onClose()}
      open
      positioning={{ placement: "bottom-start", gutter: 8, getAnchorElement: anchor }}
    >
      <PopoverContent className="max-h-(--available-height) w-[min(28rem,calc(100vw-2rem))]">
        <PopoverHeader description={TILE_EDITORS[draft.kind].hint} title={adding ? "Add tile" : "Edit tile"} />
        <PopoverBody className="flex flex-col gap-4">
          {/* The same cards as a chart's mark: the kind is the first choice, and the biggest. */}
          <RadioGroup
            columns={3}
            onValueChange={(d) => {
              const next = d.value ? changeKind(draft, d.value as TileKind, fields, others) : null;
              if (next) setDraft(next);
            }}
            value={draft.kind}
          >
            <RadioGroupLabel className="col-span-full text-xs">Kind</RadioGroupLabel>
            {kinds.map((kind) => {
              const { label, icon: Icon } = TILE_EDITORS[kind];
              return (
                <RadioGroupCard
                  className="items-center py-2"
                  disabled={changeKind(draft, kind, fields, others) === null}
                  key={kind}
                  value={kind}
                >
                  <Icon className="size-4" />
                  <span className="text-xs">{label}</span>
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
            {/* A figure has no width: the band shares its row among the figures. */}
            {inBand(draft) ? (
              <span />
            ) : (
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
            )}
            {places > 1 ? (
              <Pick
                label="Position"
                onChange={(value) => setPlaced({ band: inBand(draft), position: Number(value) })}
                options={Array.from({ length: places }, (_, i) => ({ value: String(i), label: String(i + 1) }))}
                value={String(position)}
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
          <Button onClick={() => onSave(draft, position)} size="sm">
            {adding ? "Add" : "Save"}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
