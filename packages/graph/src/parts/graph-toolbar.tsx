"use client";

import { Button, ButtonGroup, ButtonGroupSeparator, ButtonGroupText, cn, Show } from "@kanzo-tech/ui";
import {
  LassoIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
  SquareDashedIcon,
} from "lucide-react";
import { greyedOf } from "../core/kept";
import type { Motion } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphState } from "../react/use-graph-state";

export interface GraphToolbarProps extends React.ComponentProps<"div"> {
  /** How the clusters stack. Each cluster is a `ButtonGroup` in the same orientation. */
  orientation?: "horizontal" | "vertical";
}

/**
 * Solid, not `bg-card/85 backdrop-blur-md`: a diluted surface is a function of whatever the layout
 * put behind it — measured over the plane and the eight slots, `card/85` spans ΔE 9.4–11.1, against
 * the ramp's own `interchangeable` bound of 4. The buttons are `ghost` because the group carries the
 * surface, so the divisions come back as explicit separators.
 */
const CLUSTER = "rounded-lg border bg-card shadow-sm";

const ZOOM = 1.4;

/** One action per state, named for what it does: a settled layout is not paused, so it is woken. */
const TRANSPORT: Record<Motion, { pause: boolean; label: string }> = {
  running: { pause: true, label: "Pause the layout" },
  paused: { pause: false, label: "Resume the layout" },
  settled: { pause: false, label: "Run the layout" },
};

/**
 * **The commands, drawn** — how much is in full colour, the selection tools, the camera, and the live
 * layout's transport, which starts a layout from the points where they are. Each cluster is a
 * `ButtonGroup`, because a cluster is a claim that its buttons do one job; the part declares no
 * `toolbar` role, since a `role` of that kind promises roving focus and each button here is its own
 * tab stop.
 *
 * **Nothing in it moves.** The count is a readout with no button in it — a `ButtonGroupText` on the
 * clusters' surface, so it stands as tall as they do — drawn only while something is greyed, and on
 * the side away from the anchor — first in a row, which `end-*` grows leftward;
 * last in a column, which `top-*` grows downward — so every button stays where the hand left it. The
 * one Frame lives in the camera's cluster: "everything" with nothing greyed, "what the filters keep"
 * otherwise, and a canvas's pick is dropped at its chip or with Escape, like every other clause.
 *
 * The tools are not a `SegmentGroup`: that always has one member selected, and no tool — drag pans —
 * is the posture a reader spends most of their time in.
 */
export function GraphToolbar({ className, orientation = "horizontal", slot, ...rest }: GraphToolbarProps) {
  const api = useGraphContext();
  const ready = useGraphState((s) => s.structure !== null);
  const tool = useGraphState((s) => s.tool);
  const selection = useGraphState((s) => s.selection);
  const total = useGraphState((s) => s.total);
  const matching = useGraphState((s) => s.matching);
  const greyed = greyedOf({ selection, matching, total });
  const hidden = selection !== null && matching !== null ? selection.vertices.length - matching : 0;
  const frame = greyed ? "Frame what the filters keep" : "Frame everything";
  const motion = useGraphState((s) => s.motion);
  const transport = TRANSPORT[motion];
  const vertical = orientation === "vertical";

  return (
    <div
      {...rest}
      className={cn("flex items-start gap-1.5", vertical && "flex-col items-end", className)}
      data-slot={slot ?? "graph-toolbar"}
    >
      <Show when={greyed}>
        <ButtonGroup aria-label="In full colour" className={cn(CLUSTER, vertical && "order-last")} data-slot="graph-toolbar-count">
          <ButtonGroupText className="gap-1 px-2 text-xs tabular-nums">
            <span className="font-medium text-foreground">{matching?.toLocaleString()}</span>
            {total !== undefined && ` of ${total.toLocaleString()}`}
            {hidden > 0 && ` · ${hidden.toLocaleString()} hidden by other filters`}
          </ButtonGroupText>
        </ButtonGroup>
      </Show>

      <ButtonGroup aria-label="Selection tool" className={CLUSTER} orientation={orientation}>
        <Button
          aria-label="Marquee"
          aria-pressed={tool === "rect"}
          disabled={!ready}
          onClick={() => api.setTool(tool === "rect" ? null : "rect")}
          size="icon-sm"
          title="Drag a box — or just hold Shift"
          variant={tool === "rect" ? "default" : "ghost"}
        >
          <SquareDashedIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Lasso"
          aria-pressed={tool === "lasso"}
          disabled={!ready}
          onClick={() => api.setTool(tool === "lasso" ? null : "lasso")}
          size="icon-sm"
          title="Draw a loop around a cluster"
          variant={tool === "lasso" ? "default" : "ghost"}
        >
          <LassoIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup aria-label="Camera" className={CLUSTER} orientation={orientation}>
        <Button aria-label="Zoom in" disabled={!ready} onClick={() => api.zoomBy(ZOOM)} size="icon-sm" variant="ghost">
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label="Zoom out" disabled={!ready} onClick={() => api.zoomBy(1 / ZOOM)} size="icon-sm" variant="ghost">
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label={frame} disabled={!ready} onClick={() => api.frame()} size="icon-sm" title={frame} variant="ghost">
          <ScanIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup aria-label="Layout" className={CLUSTER} orientation={orientation}>
        <Button
          aria-label={transport.label}
          aria-pressed={motion === "paused"}
          disabled={!ready}
          onClick={() => (transport.pause ? api.pause() : api.resume())}
          size="icon-sm"
          title={transport.label}
          variant={motion === "paused" ? "default" : "ghost"}
        >
          {motion === "running" ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label="Re-run the layout" disabled={!ready} onClick={() => api.restart()} size="icon-sm" title="Re-run the layout" variant="ghost">
          <RotateCcwIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
}
