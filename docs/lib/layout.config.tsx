import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { KanzoLogo } from "@/components/kanzo-logo";
import { ThemeMenu } from "@/components/theme-menu";

/**
 * What every layout on this site shares — fumadocs' own convention, and it exists here for one
 * concrete reason: the theme selector has to be in the chrome of *every* page, and there are two
 * chromes. Writing it into both layouts is how the nav title and the appearance control drift.
 *
 * `slots.themeSwitch` is fumadocs' reserved place for an appearance control, and the home navbar
 * is where it lands. fumadocs' own switch drives next-themes, which `app/layout.tsx` turns off, so
 * the slot is filled rather than left to it. The docs turn the slot off and put the same
 * `ThemeMenu` in their sidebar footer, beside the repository link (`components/sidebar-footer.tsx`):
 * in the docs the slot is a bordered field built for a row of icon links, and it held nothing else.
 *
 * Links are NOT here: the two layouts publish deliberately different sets, and the docs' set is
 * computed from the page tree.
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <KanzoLogo className="h-5 w-auto text-foreground" />,
  },
  slots: { themeSwitch: ThemeMenu },
};

/** The one link both chromes carry beyond their own set: the catalogue, and the studio through it. */
export const THEMES_LINK = { text: "Themes", url: "/docs/themes" };
