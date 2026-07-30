import { heraldry } from "./derive";
import { PaletteOnboarding } from "./panel";

/**
 * A hall's heraldry, derived and measured — the screen the board shows when a hall registers.
 *
 * A **server** component on purpose, and that is the demonstration as much as the pixels are:
 * `derivePalette` costs 0.2–4.0 s per hall (the categorical search dominates), which is fine once
 * at registration and unacceptable in a browser. It runs here, at build time; the client half
 * receives a projection of the finished document and never imports the derivation.
 */
export function PaletteOnboardingShowcase() {
  return <PaletteOnboarding palettes={heraldry()} />;
}

export default PaletteOnboardingShowcase;
