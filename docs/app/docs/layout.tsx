import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { DocsPreferences } from "@/components/docs-preferences";

/**
 * Showcases are not components, and once layouts had their own group the sidebar was listing them
 * as if they were a fifth layer. They are whole screens — demonstrations of the other four
 * together — so they come out of the component nav and get a top-level link instead.
 *
 * The filter is applied to the *sidebar* tree only. `source.pageTree` keeps them, which is what
 * lets `/docs/components` still generate their cards and keeps every showcases page prerendered.
 */
const SHOWCASES_URL_PREFIX = "/docs/showcases/";

const sidebarTree = {
  ...source.pageTree,
  children: source.pageTree.children.filter(
    (node) =>
      !(
        node.type === "folder" &&
        node.children.length > 0 &&
        node.children.every(
          (child) => child.type === "page" && child.url.startsWith(SHOWCASES_URL_PREFIX),
        )
      ),
  ),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      links={[
        { text: "Components", url: "/docs/components" },
        { text: "Showcases", url: "/docs/showcases" },
      ]}
      nav={{ title: "Kanzo UI" }}
      tree={sidebarTree}
      // The live theme customizer sits in the sidebar footer, directly under the theme toggle —
      // the idiomatic fumadocs chrome slot for a persistent control. It is the library's own
      // `Preferences` panel (see `docs-preferences.tsx`); opening it re-themes every inline example.
      sidebar={{ footer: <DocsPreferences /> }}
    >
      {children}
    </DocsLayout>
  );
}
