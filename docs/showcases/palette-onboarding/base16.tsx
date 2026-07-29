import { KANZO_ID } from "@kanzo-tech/palette";
import { palettes } from "./derive";
import { Base16Comparison } from "./base16-panel";

/**
 * The four borrowed identities, authored beside derived — Kanzo&rsquo;s own excluded, since it has
 * no foreign original to be compared against.
 *
 * Server component: the derivation runs at build time, exactly as in the onboarding showcase.
 */
export function Base16Showcase() {
  return <Base16Comparison palettes={palettes().filter((p) => p.id !== KANZO_ID)} />;
}

export default Base16Showcase;
