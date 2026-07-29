import { palettes } from "./derive";
import { PaletteOnboarding } from "./panel";

/**
 * A tenant palette, derived and measured — the screen an onboarding flow would show.
 *
 * A **server** component on purpose, and that is the demonstration as much as the pixels are:
 * `derivePalette` costs 0.2–1.6 s per tenant (the categorical search dominates), which is fine
 * once at onboarding and unacceptable in a browser. It runs here, at build time; the client half
 * receives a projection of the finished document and never imports the derivation.
 */
export function PaletteOnboardingShowcase() {
  return <PaletteOnboarding palettes={palettes()} />;
}

export default PaletteOnboardingShowcase;
