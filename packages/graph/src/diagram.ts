/**
 * `@kanzo-tech/graph/diagram` — a diagram of a few dozen boxes and the labelled edges between them,
 * laid out for the reader: a thin layer over React Flow, which draws, and ELK, which places, in a
 * worker. Nodes are DOM, so a host's `Card`, `Badge`, `Popover` and buttons go inside them.
 *
 * Its own entry, because both libraries are optional peers: `import { GraphRoot }` must install
 * neither, and a subpath that statically imports them is the only place they may be reached from. It
 * shares nothing with the root's graph view but the package: that is a GraphAr graph of millions of
 * vertices on the GPU, and this is a host's own data, small enough to read every word of
 * (`/docs/design/graph`, *A diagram is a second view*).
 */
export { DiagramRoot, type DiagramEdge, type DiagramRootProps } from "./diagram/diagram-root";
export {
  DiagramCanvas,
  type DiagramCanvasProps,
  type DiagramCanvasTranslations,
  type DiagramNodeRender,
} from "./diagram/diagram-canvas";
export { DiagramControls, type DiagramControlsProps, type DiagramControlsTranslations } from "./diagram/diagram-controls";
export type { DiagramOrientation } from "./diagram/layout";
