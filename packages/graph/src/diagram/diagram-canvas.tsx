"use client";

import { ark } from "@ark-ui/react/factory";
import { cn } from "@kanzo-tech/ui";
import {
  applyNodeChanges,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { tv } from "tailwind-variants";
import { useDiagramContext, type DiagramEdge } from "./diagram-root";
import { layered } from "./layout";

/** The words the canvas gives a screen reader; a node's own words are the host's. */
export interface DiagramCanvasTranslations {
  /** What a focused node says it does, read after its contents. */
  description: string;
}

const ENGLISH: DiagramCanvasTranslations = {
  description: "Press Enter or Space to select this node, and Escape to clear the selection.",
};

/** A node, as the host draws it, told whether it is the selected one. */
export type DiagramNodeRender = (id: string, state: { selected: boolean }) => ReactNode;

export interface DiagramCanvasProps extends Omit<React.ComponentProps<typeof ark.div>, "children"> {
  /** What a node shows: any markup — a `Card`, a `Badge`, a `Popover` trigger. */
  children: DiagramNodeRender;
  translations?: Partial<DiagramCanvasTranslations>;
}

/**
 * React Flow's own variables, set to the tokens: its stylesheet draws edges and the attribution with
 * them, and a token is how a theme reaches them. The marker reads the stroke back, so an arrowhead is
 * the colour of the line it ends.
 */
const diagramCanvas = tv({
  slots: {
    root: [
      "relative size-full",
      "[--xy-edge-stroke:var(--muted-foreground)] [--xy-edge-stroke-width:1]",
      "[--xy-attribution-background-color:transparent] [&_.react-flow\\_\\_attribution_a]:text-muted-foreground",
    ],
    node: "rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
    pending: "invisible",
    handle: "opacity-0",
    label: "pointer-events-none absolute rounded-sm bg-background px-1 text-muted-foreground text-xs",
  },
});

const styles = diagramCanvas();

const DiagramNodeRenderContext = createContext<DiagramNodeRender | null>(null);

/**
 * Its ports: one in, one out, on the sides the layers run between. They are React Flow's handles,
 * which is what an edge attaches to, and invisible, because nothing here connects a node by hand.
 *
 * The host's markup sits in a `nokey` wrapper: React Flow selects a focused node on Enter and Space,
 * and without it a key pressed on a button inside the node — the marker a host puts there — would
 * select the node as well as press the button.
 */
function DiagramNode({ id, selected }: NodeProps) {
  const render = useContext(DiagramNodeRenderContext);
  const { orientation = "horizontal" } = useDiagramContext();
  const across = orientation === "horizontal";
  return (
    <>
      <Handle className={styles.handle()} isConnectable={false} position={across ? Position.Left : Position.Top} type="target" />
      <ark.div className="nokey" data-slot="diagram-node">
        {render?.(id, { selected })}
      </ark.div>
      <Handle className={styles.handle()} isConnectable={false} position={across ? Position.Right : Position.Bottom} type="source" />
    </>
  );
}

/**
 * An edge and its label. The label is DOM, through React Flow's label layer, so it is written in
 * utilities like everything else here; its place is the edge's midpoint in flow coordinates, a style
 * beside React Flow's own transform, and not a reading direction.
 */
function DiagramEdgeLine({ data, markerEnd, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY });
  const label = (data as { label?: string } | undefined)?.label;
  return (
    <>
      <BaseEdge markerEnd={markerEnd} path={path} />
      {label ? (
        <EdgeLabelRenderer>
          <ark.div
            className={styles.label()}
            data-slot="diagram-edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </ark.div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

// Module scope, because React Flow warns and remounts every node when these change identity.
const NODE_TYPES = { diagram: DiagramNode };
const EDGE_TYPES = { diagram: DiagramEdgeLine };
const MARKER = { type: MarkerType.ArrowClosed, color: "var(--xy-edge-stroke)" };

/** The ids and the ends: what a layout depends on. A label or a node's contents is not in it. */
const shapeOf = (nodes: readonly string[], edges: readonly DiagramEdge[], orientation: string) =>
  JSON.stringify([orientation, [...nodes].sort(), edges.map((e) => [e.id, e.source, e.target]).sort()]);

/**
 * **The diagram, drawn and laid out** — React Flow over the root's nodes and edges, placed by ELK's
 * layered layout. Nodes are DOM, so what a host draws in one is any markup it likes: the render prop
 * is called with the node's id and whether it is selected.
 *
 * **The layout runs when the shape changes and at no other time.** The shape is the node ids, the
 * edges' ends and the orientation; a new label, a count that moved or a node grown by a line changes
 * none of them, so nothing moves under the reader. Each run waits for React Flow to have measured
 * every node, since ELK places boxes by their size, and a node not yet placed is invisible until it
 * is. Every run ends by framing the whole diagram.
 *
 * **Nothing is edited by hand**: nodes do not drag, connect or delete — the diagram is the host's
 * data, drawn. Pan and zoom are React Flow's: drag the pane, scroll or pinch.
 *
 * ARIA: each node is React Flow's focusable `group` with `aria-roledescription="node"`, one tab stop
 * per node, described by `translations.description`; Enter or Space selects the focused node and
 * Escape clears it, and focusing a node pans it into view. Edges are not focusable: what they say is
 * their label, which is text in the page. React Flow's attribution stays — its MIT licence allows
 * removing it, and its authors ask that whoever does subscribes.
 */
export function DiagramCanvas({ children, className, slot, translations, ...rest }: DiagramCanvasProps) {
  const t = { ...ENGLISH, ...translations };
  const { edges, nodes: ids, onFailure, onSelect, orientation = "horizontal", selected } = useDiagramContext();
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const shape = shapeOf(ids, edges, orientation);
  const laidOut = useRef<string | null>(null);

  // The root's ids into React Flow's nodes: a node that stays keeps its place and its measure; a new
  // one waits, invisible, to be measured and laid out. A controlled selection is written here too, so a
  // node that arrives already selected is drawn so.
  useEffect(() => {
    setNodes((previous) => {
      const pick = (node: Node) =>
        selected === undefined || node.selected === (node.id === selected) ? node : { ...node, selected: node.id === selected };
      const kept = new Map(previous.map((node) => [node.id, node]));
      const next = ids.map((id) => pick(kept.get(id) ?? { id, className: styles.pending(), data: {}, position: { x: 0, y: 0 }, type: "diagram" }));
      return next.length === previous.length && next.every((node, i) => node === previous[i]) ? previous : next;
    });
  }, [ids, selected]);

  useEffect(() => {
    // Not before React Flow's nodes are the root's, each measured: a run over the last shape's nodes
    // would be marked done for this one.
    if (laidOut.current === shape || nodes.length !== ids.length || nodes.some((node, i) => node.id !== ids[i])) return;
    if (nodes.some((node) => !node.measured?.width || !node.measured.height)) return;
    laidOut.current = shape;
    const boxes = nodes.map((node) => ({ id: node.id, width: node.measured!.width!, height: node.measured!.height! }));
    layered(boxes, edges, orientation).then((places) => {
      // A newer shape started its own run; this answer is for a diagram that is gone.
      if (laidOut.current !== shape) return;
      setNodes((previous) =>
        previous.map((node) => ({ ...node, className: styles.node(), position: places.get(node.id) ?? node.position })),
      );
      void fitView();
    }, onFailure);
  }, [edges, fitView, ids, nodes, onFailure, orientation, shape]);

  const drawn = useMemo<Edge[]>(() => {
    const known = new Set(ids);
    return edges
      .filter((edge) => known.has(edge.source) && known.has(edge.target))
      .map(({ id, label, source, target }) => ({
        id,
        source,
        target,
        data: { label },
        focusable: false,
        markerEnd: MARKER,
        selectable: false,
        type: "diagram",
      }));
  }, [edges, ids]);

  const onNodesChange = (changes: NodeChange[]) => {
    const picks = changes.flatMap((change) => (change.type === "select" ? [change] : []));
    const controlled = selected !== undefined;
    setNodes((previous) => applyNodeChanges(controlled ? changes.filter((change) => change.type !== "select") : changes, previous));
    if (picks.length === 0) return;
    const current = controlled ? selected : (nodes.find((node) => node.selected)?.id ?? null);
    const next = picks.find((change) => change.selected)?.id ?? null;
    if (next !== current) onSelect?.(next);
  };

  return (
    <ark.div {...rest} className={cn(styles.root(), className)} data-slot={slot ?? "diagram-canvas"}>
      <DiagramNodeRenderContext.Provider value={children}>
        <ReactFlow
          ariaLabelConfig={{ "node.a11yDescription.default": t.description }}
          deleteKeyCode={null}
          edgeTypes={EDGE_TYPES}
          edges={drawn}
          multiSelectionKeyCode={null}
          nodeTypes={NODE_TYPES}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodesChange={onNodesChange}
          selectionKeyCode={null}
        />
      </DiagramNodeRenderContext.Provider>
    </ark.div>
  );
}
