import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions, THEMES_LINK } from "@/lib/layout.config";
import { getComponentGroups, OWN_GALLERY } from "@/lib/component-groups";
import { source } from "@/lib/source";
import { SidebarFooter } from "@/components/sidebar-footer";

/**
 * A group with a gallery of its own is not a fifth layer of the library, and the sidebar was
 * listing showcases as if it were once layouts got a group. Showcases are whole screens — a
 * demonstration of the four layers rather than a layer — so they come out of the component nav and
 * get a top-level link.
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
      // The toggle moves from fumadocs' icon-link field into `sidebar.footer`, beside the
      // repository; with the slot off and no icon links, that field renders nothing.
      sidebar={{ footer: <SidebarFooter /> }}
      themeSwitch={{ enabled: false }}
    >
      {children}
    </DocsLayout>
  );
}
