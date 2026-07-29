import paletteDataJson from "../palette-data.json";
import type { DerivePaletteInput } from "./derive-palette.js";

/**
 * The seed pairs this package ships — Kanzo's own, and four borrowed identities for the showcase.
 *
 * **A base16 palette is not a palette here.** It is a brand hue and a neutral hue that goes through
 * `derivePalette` exactly as a client's does, because there is one shape in the system and two
 * shapes for one idea is the defect this layer exists to remove. The old rule — "a palette may be
 * dark-only; do not invent a light side for Dracula" — was true when a palette was a set of
 * authored hexes. Under derivation it is not: a ramp keeps a foreign seed's *hue* and loses its
 * mood, so a light Dracula is a **reading** rather than an invention.
 *
 * Measured, and the pair is the point: Dracula's *brand* `#ff79c6` comes back at step 9 as
 * `#e562af` — ΔE 7.27, hue held to 0.12° — while its pastel green `#50fa7b`, which is an accent and
 * not the brand, moves ΔE 23.56 to `#00a843` at the same hue. The price a colour pays is set by
 * what it is being asked to do, not by how foreign it is: a brand only has to read as a fill, and a
 * categorical slot has to stay inside the band that keeps a *mark* legible.
 *
 * The neutral is **base03**, by the rule and not by transcription. base16 orders base00–base05
 * background → ink, so base03 is the mid-tone of the neutral ramp; for Kanzo it lands on
 * `neutral-500`, which is the swatch `derive-palette.ts` already reads as this system's neutral.
 * The tint rides along with it — Dracula's `#6272a4` is why Dracula's surfaces are not grey.
 *
 * `kanzo-dark` is deliberately absent: it is the dark half of one identity, and a document carries
 * both modes. It survives in `paletteData.palettes` only as the source of the dark syntax slots.
 */
export interface PaletteSeeds {
  label: string;
  /** The identity's brand colour, as its source designates it. */
  brand: string;
  /** The identity's neutral — base03, the mid-tone of its own neutral ramp. */
  neutral: string;
}

export const PALETTE_SEEDS = paletteDataJson.seeds as Record<string, PaletteSeeds>;

/** The default tenant's id. It is a tenant whose document happens to be committed, nothing more. */
export const KANZO_ID = "kanzo";

/** Seeds in, `derivePalette` input out. The showcase and `gen-palette.mjs` use the same call. */
export function seedInput(id: string, seeds: PaletteSeeds): DerivePaletteInput {
  return { id, label: seeds.label, brand: seeds.brand, neutral: seeds.neutral };
}
