"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2Icon, XIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../simples/card.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
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
  /** The tile's slot in the grid, brought into view as the editor opens. */
  anchor: () => HTMLElement | null;
  /** The dashboard's tiles: where the tile sits, and what a change of kind prefers not to repeat. */
  tiles?: readonly Tile[];
  /** Called with the draft and its position among its peers — the figures, or the grid's tiles. */
  onSave: (tile: Tile, index: number) => void;
  onRemove?: () => void;
  /** Cancel, the close button and Escape: the draft is dropped. */
  onClose: () => void;
  /** Where the panel docks — its width and stickiness — for a host that is not a row beside the board. */
  className?: string;
}

/**
 * **The one tile editor** — a panel docked beside the board, the way Grafana's panel options, Looker
 * Studio's properties and Power BI's visualizations pane edit a tile. It is not modal: the board
 * keeps scrolling and stays live, and the tile in the grid *is* the preview — the host draws the
 * draft in the tile's slot under the page's crossfilter, so it grows or shrinks as the width changes.
 * It lists the kind and the fields it reads, then the title, width and position. Adding and
 * editing are the same panel, and nothing reaches the dashboard until *Add* or *Save*; a new position
 * applies on save, so the tile does not move while it is edited.
 *
 * The editor draws no tile, and does not place itself: the host puts it beside the board, keeps the
 * tile's view mounted and hands the editor the slot through `anchor`, which opening brings into view.
 * A view that remounted on opening would rebuild its plot and query again.
 */
export function TileEditor({ fields, tile: draft, onChange: setDraft, anchor, tiles = [], onSave, onRemove, onClose, className }: TileEditorProps) {
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
  // Focus moves into the panel the way it moved into the popover, so Escape and Tab start there.
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  useEffect(() => {
    anchor()?.scrollIntoView({ block: "nearest" });
    panel.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const others = tiles.filter((t) => t.id !== draft.id);
  const kinds = Object.keys(TILE_EDITORS) as TileKind[];

  return (
    // A card the board already draws its tiles with, as a complementary landmark beside them.
    <Card
      aria-labelledby={titleId}
      asChild
      className={cn(
        // Docked beside the board and kept in view while it scrolls. Where it docks is the host's.
        "sticky top-0 z-5 max-h-svh w-88 shrink-0 gap-0 py-0 shadow-lg/5 outline-hidden [--space:--spacing(4)]",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) onClose();
      }}
      ref={panel}
      tabIndex={-1}
    >
      <aside>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base" id={titleId}>
            {adding ? "Add tile" : "Edit tile"}
          </CardTitle>
          <CardDescription>{TILE_EDITORS[draft.kind].hint}</CardDescription>
          <CardAction>
            <Button aria-label="Close" onClick={onClose} size="icon-sm" variant="ghost">
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>
        {/* One scrolling list, data then display, the order of Grafana's panel options. */}
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto py-4">
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

          <Field className="gap-1 border-t pt-4">
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
        </CardContent>
        <CardFooter className="justify-end py-3">
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
        </CardFooter>
      </aside>
    </Card>
  );
}
