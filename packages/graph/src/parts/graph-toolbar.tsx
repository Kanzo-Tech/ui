"use client";

import { ark } from "@ark-ui/react/factory";
import { Button, ButtonGroup, ButtonGroupSeparator, cn } from "@kanzo-tech/ui";
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
import { tv } from "tailwind-variants";
import { useGraphState } from "../react/use-graph-state";

/** Every name and hint the toolbar's buttons and clusters carry. */
export interface GraphToolbarTranslations {
  tools: string;
  marquee: string;
  marqueeHint: string;
  lasso: string;
  lassoHint: string;
  camera: string;
  zoomIn: string;
  zoomOut: string;
  /** Frame with nothing greyed. */
  frameAll: string;
  /** Frame while the filters grey something out. */
  frameKept: string;
  layout: string;
  /** One action per state of the layout, named for what it does: a settled layout is not paused, so it is woken. */
  pause: string;
  resume: string;
  run: string;
  restart: string;
}

const ENGLISH: GraphToolbarTranslations = {
  tools: "Selection tool",
  marquee: "Marquee",
  marqueeHint: "Drag a box — or just hold Shift",
  lasso: "Lasso",
  lassoHint: "Draw a loop around a cluster",
  camera: "Camera",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  frameAll: "Frame everything",
  frameKept: "Frame what the filters keep",
  layout: "Layout",
  pause: "Pause the layout",
  resume: "Resume the layout",
  run: "Run the layout",
  restart: "Re-run the layout",
};

export interface GraphToolbarProps extends React.ComponentProps<typeof ark.div> {
  /** How the clusters stack. Each cluster is a `ButtonGroup` in the same orientation. */
  orientation?: "horizontal" | "vertical";
  translations?: Partial<GraphToolbarTranslations>;
}

/**
 * Solid, not `bg-card/85 backdrop-blur-md`: a diluted surface is a function of whatever the layout
 * put behind it — measured over the plane and the eight slots, `card/85` spans ΔE 9.4–11.1, against
 * the ramp's own `interchangeable` bound of 4. The buttons are `ghost` because the group carries the
 * surface, so the divisions come back as explicit separators.
 */
const graphToolbar = tv({
  slots: {
    root: "flex items-start gap-1.5",
    cluster: "rounded-lg border bg-card shadow-sm",
  },
  variants: {
    orientation: { horizontal: {}, vertical: { root: "flex-col items-end" } },
  },
});

const ZOOM = 1.4;

/** One action per state, named for what it does. */
const TRANSPORT: Record<Motion, { pause: boolean; label: "pause" | "resume" | "run" }> = {
  running: { pause: true, label: "pause" },
  paused: { pause: false, label: "resume" },
  settled: { pause: false, label: "run" },
};

/**
 * **The commands, drawn** — the selection tools, the camera, and the live layout's transport, which
 * starts a layout from the points where they are. Each cluster is a
 * `ButtonGroup`, because a cluster is a claim that its buttons do one job; the part declares no
 * `toolbar` role, since a `role` of that kind promises roving focus and each button here is its own
 * tab stop.
 *
 * **No count.** It said *N of T* beside the tools while something was greyed, and the page said it
 * three more times — `GraphCounts`, the legend and the filter's chip — so a reader met an unlabelled
 * box repeating a figure. What only it said, *M hidden by other filters*, is `GraphCounts`' now. The
 * one Frame lives in the camera's cluster: "everything" with nothing greyed, "what the filters keep"
 * otherwise, and a canvas's pick is dropped at its chip or with Escape, like every other clause.
 *
 * The tools are not a `SegmentGroup`: that always has one member selected, and no tool — drag pans —
 * is the posture a reader spends most of their time in.
 */
export function GraphToolbar({ className, orientation = "horizontal", slot, translations, ...rest }: GraphToolbarProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphToolbar({ orientation });
  const api = useGraphContext();
  const ready = useGraphState((s) => s.structure !== null);
  const tool = useGraphState((s) => s.tool);
  const selection = useGraphState((s) => s.selection);
  const total = useGraphState((s) => s.total);
  const matching = useGraphState((s) => s.matching);
  const greyed = greyedOf({ selection, matching, total });
  const frame = greyed ? t.frameKept : t.frameAll;
  const motion = useGraphState((s) => s.motion);
  const transport = TRANSPORT[motion];
  const cluster = styles.cluster();

  return (
    <ark.div {...rest} className={cn(styles.root(), className)} data-slot={slot ?? "graph-toolbar"}>
      <ButtonGroup aria-label={t.tools} className={cluster} orientation={orientation}>
        <Button
          aria-label={t.marquee}
          aria-pressed={tool === "rect"}
          disabled={!ready}
          onClick={() => api.setTool(tool === "rect" ? null : "rect")}
          size="icon-sm"
          title={t.marqueeHint}
          variant={tool === "rect" ? "default" : "ghost"}
        >
          <SquareDashedIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label={t.lasso}
          aria-pressed={tool === "lasso"}
          disabled={!ready}
          onClick={() => api.setTool(tool === "lasso" ? null : "lasso")}
          size="icon-sm"
          title={t.lassoHint}
          variant={tool === "lasso" ? "default" : "ghost"}
        >
          <LassoIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup aria-label={t.camera} className={cluster} orientation={orientation}>
        <Button aria-label={t.zoomIn} disabled={!ready} onClick={() => api.zoomBy(ZOOM)} size="icon-sm" variant="ghost">
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label={t.zoomOut} disabled={!ready} onClick={() => api.zoomBy(1 / ZOOM)} size="icon-sm" variant="ghost">
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label={frame} disabled={!ready} onClick={() => api.frame()} size="icon-sm" title={frame} variant="ghost">
          <ScanIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup aria-label={t.layout} className={cluster} orientation={orientation}>
        <Button
          aria-label={t[transport.label]}
          aria-pressed={motion === "paused"}
          disabled={!ready}
          onClick={() => (transport.pause ? api.pause() : api.resume())}
          size="icon-sm"
          title={t[transport.label]}
          variant={motion === "paused" ? "default" : "ghost"}
        >
          {motion === "running" ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <ButtonGroupSeparator />
        <Button aria-label={t.restart} disabled={!ready} onClick={() => api.restart()} size="icon-sm" title={t.restart} variant="ghost">
          <RotateCcwIcon />
        </Button>
      </ButtonGroup>
    </ark.div>
  );
}
