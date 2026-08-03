"use server";

import { type PaletteView, viewOf } from "./derive";

/**
 * Derive a document from two seeds a visitor typed, on the server, on demand.
 *
 * This is what closes the loop the reference systems all close and we did not: daisyUI's generator
 * emits the same `@plugin` block its plugin ingests, Material re-imports its own JSON. Until now the
 * screen showed five documents fixed at build time, so "a client supplies two colours" was a claim
 * about a code path nobody could exercise.
 *
 * **A server action and not a client call, and the boundary is the point rather than a technicality.**
 * `derivePalette` costs 0.2–1.6 s — the categorical search dominates — and `boundary.test.ts` keeps
 * `@kanzo-tech/palette` out of the browser graph with a text match, so even `import type` fails over
 * there. Running it here is the same trade the whole layer is built on: derivation is authoring-time,
 * and the runtime only applies what it produced.
 *
 * It returns a discriminated result rather than throwing. `derivePalette` refuses malformed input by
 * design — a seed that is not a colour, an id that could not be interpolated into a selector — and a
 * refusal is an answer this screen should render, not a 500.
 */
export type DeriveResult =
  | { ok: true; palette: PaletteView }
  | { ok: false; message: string };

const HEX = /^#[0-9a-f]{6}$/i;

function slug(label: string): string {
  const slugged = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z0-9][a-z0-9-]*$/.test(slugged) ? slugged : "custom";
}

export async function deriveSeeds(input: {
  label: string;
  brand: string;
  neutral: string;
}): Promise<DeriveResult> {
  const label = input.label.trim() || "Your palette";
  const brand = input.brand.trim();
  const neutral = input.neutral.trim();

  // Checked here and not only in the field, because a server action is a public endpoint: anything
  // that reaches `derivePalette` reaches a search, and a search is the expensive thing to guard.
  for (const [name, value] of [
    ["brand", brand],
    ["neutral", neutral],
  ] as const) {
    if (!HEX.test(value)) {
      return { ok: false, message: `The ${name} seed must be a six-digit hex colour, like #2b7fff.` };
    }
  }

  try {
    // The id is slugged from the label rather than fixed, because the snippet this screen offers is
    // meant to be pasted and run — and `id: "custom"` would author a document called that. Slugged
    // to exactly what `derivePalette` accepts (`/^[a-z0-9][a-z0-9-]*$/`), since it is interpolated
    // into `[data-identity="…"]` for a second brand, and falling back rather than throwing: a label
    // of "△" is a naming problem, not a reason to refuse two perfectly good colours.
    return { ok: true, palette: viewOf({ id: slug(label), label, brand, neutral }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Derivation failed." };
  }
}
