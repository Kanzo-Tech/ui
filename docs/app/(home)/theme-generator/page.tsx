import type { Metadata } from "next";
import { ThemeGenerator } from "./theme-generator";

export const metadata: Metadata = {
  title: "Theme generator — Kanzo UI",
  description:
    "Author a theme in the library's own controls: the preview wears the values and the CSS block is those values reformatted.",
};

/**
 * The generator's route. A server component whose whole job is the metadata — the title a shared
 * link shows, which is the thing an iframe could not have.
 */
export default function Page() {
  return <ThemeGenerator />;
}
