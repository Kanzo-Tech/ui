"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { createContext, useContext, type ReactNode } from "react";
import type { DiagramOrientation } from "./layout";

/** An edge between two nodes, by their ids, with the words drawn on it. */
export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DiagramRootProps {
  /**
   * The nodes, by id. What a node shows is `DiagramCanvas`'s render prop, so a node is only its id
   * here: the host looks its own record up by it, and the diagram holds nothing it would have to keep
   * in step.
   */
  nodes: readonly string[];
  /** The edges. One whose end is not among `nodes` is not drawn. */
  edges: readonly DiagramEdge[];
  /**
   * Which way the layers run.
   * @default "horizontal"
   */
  orientation?: DiagramOrientation;
  /** The selected node, controlled. Absent, the diagram keeps its own; `null` is none. */
  selected?: string | null;
  /** A node was selected — by a click or by Enter or Space on a focused node — or `null`, deselected. */
  onSelect?: (id: string | null) => void;
  /** Every failure, as thrown: today, a layout ELK could not run, its worker blocked or broken. */
  onFailure: (error: unknown) => void;
  /** The canvas and its chrome. */
  children?: ReactNode;
}

type DiagramContextValue = Omit<DiagramRootProps, "children">;

const DiagramContext = createContext<DiagramContextValue | null>(null);

/** Strict: outside a root there is no diagram, and a `null` would read as an empty one. */
export function useDiagramContext(): DiagramContextValue {
  const value = useContext(DiagramContext);
  if (!value) throw new Error("useDiagramContext must be used inside a <DiagramRoot>");
  return value;
}

/**
 * **The diagram's data and its policy; it renders no element**, as `GraphRoot` renders none. Under
 * it, `DiagramCanvas` draws the nodes and the edges, and `DiagramControls` moves the camera: React
 * Flow's provider is here so the two need not be nested in each other, and a host places its
 * controls wherever its layout wants them.
 */
export function DiagramRoot({ children, ...props }: DiagramRootProps) {
  return (
    <DiagramContext.Provider value={props}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </DiagramContext.Provider>
  );
}
