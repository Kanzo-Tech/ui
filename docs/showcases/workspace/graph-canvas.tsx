"use client";

import { Fragment } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Show,
  Spinner,
  cn,
} from "@kanzo-tech/ui";
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
import { GraphCanvas as Surface } from "@kanzo-tech/graph";
import { useGraphView, type Motion, type SelectionSource } from "./graph-state";

/**
 * The chrome that floats over the canvas.
 *
 * The surface belongs to the group and the buttons inside are `ghost`, because giving the group a
 * card background *and* the buttons an `outline` border draws the box twice — invisible on a pale
 * page, and on a dark canvas a washed-out slab with see-through buttons sitting on it.
 *
 * The cost of that is real: `ButtonGroup` segments a cluster by collapsing its children's *shared
 * borders*, and ghost buttons have none to collapse. So the divisions come back as explicit
 * `ButtonGroupSeparator`s. And the radius matches `Button`'s own `rounded-lg` — at `rounded-md` the
 * group's corner and the corner a button reveals on hover were visibly different curves.
 *
 * **Solid, not `bg-card/85 backdrop-blur-md`.** A panel is an occluder, not a veil, and a diluted
 * surface is a function of whatever the layout happened to put behind it: measured over the plane
 * and the eight slots, `card/85` spans ΔE 9.4–11.1 and the legend's `card/80` spans 12.6–14.0 —
 * two ramp steps of drift in a token whose whole job is to be one colour, against the ramp's own
 * `interchangeable` bound of 4. An alpha step cannot rescue it either, and that is measured in the
 * theme rather than guessed here: at the surface band the alpha reproducing a raised step is 0–8
 * bytes, so a `--popover` bound to one shows the page's own text through itself.
 */
const FLOATING = "rounded-lg border bg-card shadow-sm";

/**
 * The placeholder's dot spacing, which is this file's number rather than the renderer's.
 *
 * It was `GRID`, imported from `@kanzo-tech/graph` — the spacing the overlay painter keeps the
 * *live* grid inside. The placeholder has no camera and no graph: it is a picture of the canvas this
 * page is about to become, drawn so the wait does not read as a broken page, and nothing about it
 * has to agree with a transform that does not exist yet. Borrowing the renderer's constant for it
 * was borrowing a number for its looks.
 */
const PLACEHOLDER_GRID = 22;

/**
 * The canvas before it is a canvas.
 *
 * Not a `Skeleton`: a skeleton stands in for content whose shape you can predict, and a graph has
 * no predictable shape — a big grey slab just tells the reader the page is broken. What it shows
 * instead is the canvas it is about to become, with the same plane and the same dot grid, and one
 * line saying what is taking the time. It took a `look` and never read it: nothing a look carries
 * is visible before there are points to draw.
 */
function CanvasPlaceholder({ note }: { note: string }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: `${PLACEHOLDER_GRID}px ${PLACEHOLDER_GRID}px`,
        }}
      />
      <p
        className={cn(
          "relative flex items-center gap-2 text-xs",
          "text-muted-foreground",
        )}
      >
        <Spinner className="size-3.5" />
        {note}
      </p>
    </div>
  );
}

/**
 * The package's canvas — renderer, gesture, labels and hover card — with this page's placeholder
 * over it until the corpus is open, and the failure in its place when it will not.
 */
export function GraphCanvas() {
  const { failure, ready } = useGraphView();
  if (failure !== null) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-background p-6">
        <p className="max-w-sm text-center text-destructive text-sm">{failure}</p>
      </div>
    );
  }
  return (
    <Surface className="absolute inset-0">
      <Show when={!ready}>
        <CanvasPlaceholder note="Opening the corpus…" />
      </Show>
    </Surface>
  );
}

/**
 * A cell, as text. Never as whatever DuckDB happened to hand back: a DATE column arrives as a
 * `Date`, and rendering one crashes React with "Objects are not valid as a React child".
 */
export function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

// ── Canvas chrome ────────────────────────────────────────────────────────────

/**
 * The selection tools — the only control on the canvas that changes what a gesture *means*, which
 * is why it sits alone at the corner your hand is already heading for.
 *
 * Not a `SegmentGroup`: that always has exactly one member selected, and "no tool" is the posture
 * you spend most of your time in.
 */
const TOOLS = [
  { id: "rect", label: "Marquee", icon: SquareDashedIcon, hint: "Drag a box — or just hold Shift" },
  { id: "lasso", label: "Lasso", icon: LassoIcon, hint: "Draw a loop around a cluster" },
] as const;

export function GraphToolbar() {
  const { ready, setTool, tool } = useGraphView();
  return (
    <ButtonGroup
      aria-label="Selection tool"
      className={cn(FLOATING, "absolute end-2 top-2 z-10")}
    >
      {TOOLS.map((entry, i) => (
        <Fragment key={entry.id}>
          <Show when={i > 0}>
            <ButtonGroupSeparator />
          </Show>
          <Button
            aria-label={entry.label}
            aria-pressed={tool === entry.id}
            disabled={!ready}
            onClick={() => setTool(tool === entry.id ? null : entry.id)}
            size="icon-sm"
            title={entry.hint}
            variant={tool === entry.id ? "default" : "ghost"}
          >
            <entry.icon />
          </Button>
        </Fragment>
      ))}
    </ButtonGroup>
  );
}

/**
 * What the canvas is holding, and the two things you can do with it.
 *
 * Also a `ButtonGroup`: the count is a `ButtonGroupText`, which is what that part exists for — a
 * label living inside the cluster rather than a `<span>` bolted to its side.
 *
 * It appears only when there is a selection, so the reading posture leaves the canvas clean. The
 * number is the canvas' own clause, not the crossfilter's resolved total — the footer already
 * reports that, and other panels write to it too.
 */
/** What each origin is called, so the corner can say where the selection came from. */
const SOURCE_NAME: Record<SelectionSource, string> = {
  marquee: "Marquee",
  lasso: "Lasso",
  node: "Node",
  order: "Order",
  ask: "Ask",
};

export function GraphSelection() {
  const { commands, corpus, selection } = useGraphView();
  if (!selection) return null;
  return (
    <ButtonGroup
      aria-label="Current selection"
      className={cn(FLOATING, "absolute start-2 top-2 z-10")}
    >
      <ButtonGroupText className="gap-1.5 ps-1.5 pe-2 text-xs">
        <Badge className="text-[10px]" size="xs" variant="secondary">
          {SOURCE_NAME[selection.source]}
        </Badge>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">
            {selection.vertices.length.toLocaleString()}
          </span>
          {corpus === null ? " selected" : ` of ${corpus.toLocaleString()} selected`}
        </span>
      </ButtonGroupText>
      <ButtonGroupSeparator />
      <Button
        aria-label="Frame the selection"
        onClick={() => commands.frameSelection()}
        size="icon-sm"
        title="Frame the selection"
        variant="ghost"
      >
        <ScanIcon />
      </Button>
      <Button
        aria-label="Clear the selection"
        onClick={() => commands.clear()}
        size="icon-sm"
        title="Clear the selection"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </ButtonGroup>
  );
}

/**
 * The bottom-end corner: everything that moves the picture without changing what it says.
 *
 * Two vertical `ButtonGroup`s stacked — the camera, and the layout's transport. Two groups rather
 * than one split by a separator, for the reason a group is a claim: zooming and pausing a
 * simulation are not the same job. The transport lives here and not beside the selection tools
 * because it belongs with the camera — both answer "what is the view doing", while a tool answers
 * "what does my drag do".
 *
 * Paused is stated, not implied: a converged graph and a stopped one look identical, so the button
 * turns solid and the footer says which one you are looking at.
 */
/**
 * One action per state, and the control names the one you are about to get. A layout that has
 * converged is not paused, so offering "Resume" there would promise something `unpause` cannot do.
 */
const TRANSPORT: Record<Motion, { action: "pause" | "resume"; label: string }> = {
  running: { action: "pause", label: "Pause the layout" },
  paused: { action: "resume", label: "Resume the layout" },
  settled: { action: "resume", label: "Wake the layout — it has settled" },
};

export function GraphZoom() {
  const { commands, motion, pinned, ready } = useGraphView();
  const transport = TRANSPORT[motion];
  // Shown only when there is something to release, and it names the number: a pinned point is drawn
  // exactly like an unpinned one, so this control is the only place the reader can see that they
  // are holding part of the layout still.
  const release = `Release ${pinned} pinned ${pinned === 1 ? "node" : "nodes"}`;

  return (
    <div className="absolute end-2 bottom-2 z-10 flex flex-col items-end gap-1.5">
      <ButtonGroup aria-label="Layout" className={FLOATING} orientation="vertical">
        <Button
          aria-label={transport.label}
          aria-pressed={motion === "paused"}
          disabled={!ready}
          onClick={() => (transport.action === "pause" ? commands.pause() : commands.resume())}
          size="icon-sm"
          title={transport.label}
          variant={motion === "paused" ? "default" : "ghost"}
        >
          {motion === "running" ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Re-run the layout"
          disabled={!ready}
          onClick={() => commands.restart()}
          size="icon-sm"
          title="Re-run the layout"
          variant="ghost"
        >
          <RotateCcwIcon />
        </Button>
        <Show when={pinned > 0}>
          <ButtonGroupSeparator />
          <Button
            aria-label={release}
            onClick={() => commands.unpin()}
            size="icon-sm"
            title={release}
            variant="ghost"
          >
            <PinOffIcon />
          </Button>
        </Show>
      </ButtonGroup>

      <ButtonGroup
        aria-label="Zoom and fit"
        className={FLOATING}
        orientation="vertical"
      >
        <Button
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => commands.zoomBy(1.4)}
          size="icon-sm"
          variant="ghost"
        >
          <PlusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => commands.zoomBy(1 / 1.4)}
          size="icon-sm"
          variant="ghost"
        >
          <MinusIcon />
        </Button>
        <ButtonGroupSeparator />
        <Button
          aria-label="Fit to view"
          disabled={!ready}
          onClick={() => commands.fit()}
          size="icon-sm"
          variant="ghost"
        >
          <MaximizeIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
}
