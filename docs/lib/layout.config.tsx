import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { ThemeMenu } from "@/components/theme-menu";

/**
 * What every layout on this site shares — fumadocs' own convention, and it exists here for one
 * concrete reason: the theme selector has to be in the chrome of *every* page, and there are two
 * chromes. Writing it into both layouts is how the nav title and the appearance control drift.
 *
 * `slots.themeSwitch` is fumadocs' reserved place for an appearance control: the navbar on the home
 * layout, the footer row of the sidebar in the docs. Both layouts used to disable it — fumadocs'
 * own switch drives next-themes, which `app/layout.tsx` turns off, so it was a button that changed
 * no pixel. Filling the slot rather than disabling it is the difference between a site with a theme
 * control and a site with a hole where one goes.
 *
 * Links are NOT here: the two layouts publish deliberately different sets, and the docs' set is
 * computed from the page tree.
 */
export const baseOptions: BaseLayoutProps = {
  nav: { title: "Kanzo UI" },
  slots: { themeSwitch: ThemeMenu },
};

/** The one link both chromes carry beyond their own set: the catalogue, and the studio through it. */
export const THEMES_LINK = { text: "Themes", url: "/docs/themes" };
