import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions, THEMES_LINK } from "@/lib/layout.config";
import { getComponentGroups, OWN_GALLERY } from "@/lib/component-groups";
import { source } from "@/lib/source";
import { DocsPreferences } from "@/components/docs-preferences";

/**
 * A group with a gallery of its own is not a fifth layer of the library, and the sidebar was
 * listing showcases as if it were once layouts got a group. Showcases are whole screens and blocks
 * are the furniture two of them share; both are demonstrations of the four layers rather than a
 * layer, so they come out of the component nav and get a top-level link each.
 *
 * `OWN_GALLERY` is the one place that set is written, shared with `ComponentsList` — the prefix
 * used to be a literal here and the exclusion a second literal there, which is two spellings of
 * one idea in two files. The titles come off the page tree for the same reason.
 *
 * The filter is applied to the *sidebar* tree only. `source.pageTree` keeps them, which is what
 * lets each gallery still generate its cards and keeps every page prerendered.
 */
const GALLERY_PREFIXES = OWN_GALLERY.map((slug) => `/docs/${slug}/`);

const sidebarTree = {
  ...source.pageTree,
  children: source.pageTree.children.filter(
    (node) =>
      !(
        node.type === "folder" &&
        node.children.length > 0 &&
        node.children.every(
          (child) =>
            child.type === "page" &&
            GALLERY_PREFIXES.some((prefix) => child.url.startsWith(prefix)),
        )
      ),
  ),
};

/** "Components", then one link per gallery, titled by its own `meta.json`. */
const galleryLinks = OWN_GALLERY.flatMap((slug) => {
  const group = getComponentGroups().find((g) => g.slug === slug);
  return group ? [{ text: group.title, url: `/docs/${slug}` }] : [];
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
      links={[{ text: "Components", url: "/docs/components" }, THEMES_LINK, ...galleryLinks]}
      tree={sidebarTree}
      // The live theme customizer sits in the sidebar footer, under the theme menu that
      // `baseOptions` puts in the row above it (fumadocs' `themeSwitch` slot). It is the library's
      // own `Preferences` panel (see `docs-preferences.tsx`); opening it re-themes the whole site.
      // Keyed because `Sidebar` renders this same node in two arrays — the desktop aside and the
      // mobile drawer — and React asks for a key on both.
      sidebar={{ footer: <DocsPreferences key="docs-preferences" /> }}
    >
      {children}
    </DocsLayout>
  );
}
