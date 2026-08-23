import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions, THEMES_LINK } from "@/lib/layout.config";
import { getComponentGroups, OWN_GALLERY } from "@/lib/component-groups";
import { source } from "@/lib/source";

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
      // **No sidebar footer, and the Customize panel that was in it is gone from the site chrome.**
      // The theme menu in the row above (fumadocs' `themeSwitch` slot, filled by `baseOptions`)
      // carries the whole colour axis now, appearance included, and what the panel had left was
      // four shape-and-type knobs nobody opens from a documentation page. `Preferences` is still
      // demonstrated — ten showcases and its own page — so nothing about the component went with
      // it; what went was a second control cluster twelve pixels from the first.
    >
      {children}
    </DocsLayout>
  );
}
