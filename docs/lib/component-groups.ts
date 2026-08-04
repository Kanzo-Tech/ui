import type { Folder, Node } from "fumadocs-core/page-tree";
import { source } from "./source";

/**
 * The one place the docs answer "what components exist, and which group is each in".
 *
 * Everything here is derived from `source.pageTree`, which fumadocs builds from the MDX files
 * and `meta.json` on disk. There is deliberately **no list of components** in this file: adding
 * `content/docs/<group>/foo.mdx` puts Foo in the index, and deleting it removes it. Shark UI's
 * equivalent grid is driven off the page tree too, but gates each entry on a hand-kept thumbnail
 * map — so a component missing from that map disappears from the grid with no error. That is the
 * failure mode this module exists to make impossible.
 */

export interface ComponentEntry {
  /** Last URL segment — `button`, `two-pane-layout`. Matches the examples directory. */
  slug: string;
  title: string;
  description: string;
  url: string;
  /** Group slug the page sits under — `simples`, `composites`, `layouts`, `showcases`. */
  group: string;
}

export interface ComponentGroup {
  slug: string;
  title: string;
  description: string;
  components: ComponentEntry[];
}

/** `/docs/overlays/dialog` → `["overlays", "dialog"]`; a root page like `/docs/installation` → `["installation"]`. */
function segmentsAfterBase(url: string): string[] {
  return url.split("/").filter(Boolean).slice(1);
}

function asText(node: unknown, fallback = ""): string {
  return typeof node === "string" ? node : fallback;
}

function entriesOf(folder: Folder): ComponentEntry[] {
  return folder.children.flatMap((child: Node) => {
    if (child.type !== "page") return [];

    // A component page always lives in a directory: `/docs/<group>/<slug>`. The "Getting
    // started" pages sit at `/docs/<slug>`, which is how they are excluded — by their shape in
    // the tree, not by being named here.
    const segments = segmentsAfterBase(child.url);
    if (segments.length < 2) return [];

    const page = source.getNodePage(child);

    return [
      {
        slug: segments[segments.length - 1],
        group: segments[0],
        title: page?.data.title ?? asText(child.name, segments[segments.length - 1]),
        description: page?.data.description ?? asText(child.description),
        url: child.url,
      },
    ];
  });
}

/** Every component group in page-tree order, each with its pages. */
export function getComponentGroups(): ComponentGroup[] {
  return source.pageTree.children.flatMap((node: Node) => {
    if (node.type !== "folder") return [];

    const components = entriesOf(node);
    if (components.length === 0) return [];

    return [
      {
        slug: components[0].group,
        title: asText(node.name, components[0].group),
        description: asText(node.description),
        components,
      },
    ];
  });
}

