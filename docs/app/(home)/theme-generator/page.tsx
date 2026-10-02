import type { Metadata } from "next";
import { ThemeGenerator } from "./theme-generator";

export const metadata: Metadata = {
  title: "Theme generator — Kanzo UI",
  description:
    "Author a theme family — a light theme and a dark one — in OKLCH, with live WCAG contrast checks. Copy the CSS, an instance config, or a link.",
};

/**
 * The generator's route. A server component whose whole job is the metadata — the title a shared
 * link shows, which is the thing an iframe could not have.
 */
export default function Page() {
  return <ThemeGenerator />;
}
