"use client";

import { Button, ButtonGroup, ButtonGroupSeparator, ButtonGroupText, cn, Show } from "@kanzo-tech/ui";
import {
  LassoIcon,
  MaximizeIcon,
  MinusIcon,
  PauseIcon,
  PinOffIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
  SquareDashedIcon,
  XIcon,
} from "lucide-react";
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
 * **The commands, drawn** — the selection tools, the selection and what to do with it, the camera, and
 * the live layout's transport, which starts a layout from the points where they are. Each cluster is a `ButtonGroup`, because a cluster
 * is a claim that its buttons do one job; the part declares no `toolbar` role, since a `role` of that
 * kind promises roving focus and each button here is its own tab stop.
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
  const motion = useGraphState((s) => s.motion);
  const pinned = useGraphState((s) => s.pinned.length);
  const transport = TRANSPORT[motion];
  const release = `Release ${pinned} pinned ${pinned === 1 ? "node" : "nodes"}`;

  return (
    <div
      {...rest}
      className={cn("flex items-start gap-1.5", orientation === "vertical" && "flex-col items-end", className)}
      data-slot={slot ?? "graph-toolbar"}
    >
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

      <Show when={selection !== null}>
        <ButtonGroup aria-label="Current selection" className={CLUSTER} data-slot="graph-toolbar-selection">
          <ButtonGroupText className="gap-1 ps-2 pe-2 text-xs tabular-nums">
            <span className="font-medium text-foreground">{selection?.vertices.length.toLocaleString()}</span>
            {total === undefined ? " selected" : ` of ${total.toLocaleString()} selected`}
          </ButtonGroupText>
          <ButtonGroupSeparator />
          <Button aria-label="Frame the selection" onClick={() => api.frameSelection()} size="icon-sm" title="Frame the selection" variant="ghost">
            <ScanIcon />
          </Button>
          <Button aria-label="Clear the selection" onClick={() => api.clear()} size="icon-sm" title="Clear the selection" variant="ghost">
            <XIcon />
          </Button>
        </ButtonGroup>
      </Show>

      <ButtonGroup aria-label="Zoom and fit" className={CLUSTER} orientation={orientation}>
        <Button aria-label="Zoom in" disabled={!ready} onClick={() => api.zoomBy(ZOOM)} size="icon-sm" variant="ghost">
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label="Zoom out" disabled={!ready} onClick={() => api.zoomBy(1 / ZOOM)} size="icon-sm" variant="ghost">
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label="Fit to view" disabled={!ready} onClick={() => api.fit()} size="icon-sm" variant="ghost">
          <MaximizeIcon />
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
        <Show when={pinned > 0}>
          <ButtonGroupSeparator />
          <Button aria-label={release} onClick={() => api.unpin()} size="icon-sm" title={release} variant="ghost">
            <PinOffIcon />
          </Button>
        </Show>
      </ButtonGroup>
    </div>
  );
}
