import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

/**
 * Showcases are not components, and once layouts had their own group the sidebar was listing them
 * as if they were a fifth layer. They are whole screens — demonstrations of the other four
 * together — so they come out of the component nav and get a top-level link instead.
 *
 * The filter is applied to the *sidebar* tree only. `source.pageTree` keeps them, which is what
 * lets `/docs/components` still generate their cards and keeps every showcases page prerendered.
 */
const BLOCKS_URL_PREFIX = "/docs/showcases/";

const sidebarTree = {
  ...source.pageTree,
  children: source.pageTree.children.filter(
    (node) =>
      !(
        node.type === "folder" &&
        node.children.length > 0 &&
        node.children.every(
          (child) => child.type === "page" && child.url.startsWith(BLOCKS_URL_PREFIX),
        )
      ),
  ),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      links={[
        { text: "Components", url: "/docs/components" },
        { text: "Showcases", url: "/docs/showcases/app-shell" },
      ]}
      nav={{ title: "Kanzo UI" }}
      tree={sidebarTree}
    >
      {children}
    </DocsLayout>
  );
}
