import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { STORAGE_KEY, paletteIndex, type SwatchOption } from "@kanzo-tech/theme";

/**
 * The docs site as a tenant that publishes five palettes.
 *
 * This is the whole server half of palette selection, and there is not much to it by design: a
 * palette is a *document*, so choosing one is choosing which stylesheet to serve — decided here,
 * before the first byte, rather than by an attribute a script writes after paint.
 *
 * Server-only, and it has to be: `readFileSync` and `cookies()` are both unavailable in a browser,
 * which is exactly the property that keeps `@kanzo-tech/palette` and its 0.2–7.4 s derivation out of
 * the client bundle. The client half never sees a colour value — it sees an id and a swatch strip.
 */

/**
 * Where the compiled documents are, on this machine.
 *
 * Two attempts at resolving this failed, and both failures are about the bundler rather than about
 * Node. `require.resolve("@kanzo-tech/theme/palettes/" + id + ".css")` makes webpack build a context
 * module for the whole directory, which the package's `exports` field then rejects — "Package path
 * ./palettes is not exported". Resolving the package's `package.json` instead and joining the rest
 * fails more quietly: inside a webpack bundle `require.resolve` returns a MODULE ID, not a
 * filesystem path, so `dirname` of it produced a relative path and the read raised `ENOENT` against
 * `packages/theme/palettes/…`.
 *
 * So: the real path, plainly. This is a workspace docs app reading a workspace package, and saying
 * that out loud is more honest than a resolution trick that only looks portable. A real tenant does
 * not do this at all — their document comes from wherever their data lives, and `paletteCss` is the
 * seam where that swap happens.
 */
const themeDir = join(process.cwd(), "node_modules", "@kanzo-tech", "theme");

/**
 * A palette's compiled stylesheet, read from the package it ships in.
 *
 * The default has none: `tokens.css` *is* Kanzo compiled, and it is already on the page through
 * `@kanzo-tech/ui/styles.css`. Serving a second copy would paint the same document twice.
 *
 * Every other document is compiled with `elevate`, so its selectors are `:root:root` / `.dark:root`
 * and it outranks `tokens.css` on specificity. That is what makes this safe to inject anywhere in
 * the tree: React may hoist a `<style>` into `<head>` before or after the imported sheet, and the
 * result must not depend on which.
 */
const cache = new Map<string, string>();

export function paletteCss(id: string): string | null {
  const entry = paletteIndex.find((palette) => palette.id === id);
  if (!entry || entry.isDefault) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const css = readFileSync(join(themeDir, "palettes", `${id}.css`), "utf8");
  cache.set(id, css);
  return css;
}

/**
 * The palette this request asked for, from the same cookie the pre-paint script reads.
 *
 * An unknown id — a document retired since the visitor chose it — falls back to the default here,
 * and `KanzoThemeProvider` separately notices, clears the preference and can say so. Both halves
 * have to handle it: the server cannot leave the page unpainted while it waits for React.
 */
export async function requestedPalette(): Promise<string> {
  const raw = (await cookies()).get(STORAGE_KEY)?.value;
  if (!raw) return defaultPalette;
  try {
    const id = (JSON.parse(decodeURIComponent(raw)) as { palette?: unknown }).palette;
    return typeof id === "string" && paletteIndex.some((p) => p.id === id) ? id : defaultPalette;
  } catch {
    return defaultPalette;
  }
}

export const defaultPalette = paletteIndex.find((p) => p.isDefault)?.id ?? "";

/**
 * The registry, narrowed to what a control needs.
 *
 * `paletteIndex` also carries seeds and a capacity, which are facts about the derivation and not
 * about offering a choice — the panel draws `label` and a swatch strip and has no use for either.
 */
export const paletteOptions: SwatchOption[] = paletteIndex.map(({ id, label, swatches }) => ({
  value: id,
  label,
  swatches,
}));

/**
 * A document's identities, as the panel needs them — the mapper `@kanzo-tech/theme` says a host
 * writes ("a host maps its document to this shape once, on the server") and that nothing had.
 *
 * Its whole job is to NARROW. A document's own `Identity` carries a brand seed, a ramp pair, a
 * categorical set and its record rows, none of which a browser has any use for, and
 * `boundary.test.ts` keeps that type out of the client graph with a text match — so the narrowing is
 * not tidiness, it is the boundary. What crosses is an id, the label the client wrote, and per-mode
 * swatches.
 *
 * The swatches are the identity's OWN categorical set, not the document's: the chart wheel is spun
 * from each brand's hue, so a bank's retail blue and its private gold publish different ones. A strip
 * drawn from the document would picture every card identically and the control would look broken.
 */
export function identityOptions(paletteId: string): SwatchOption[] {
  const entry = paletteIndex.find((palette) => palette.id === paletteId);
  if (!entry) return [];
  const document = JSON.parse(
    readFileSync(join(themeDir, "palettes", `${paletteId}.json`), "utf8"),
  ) as {
    identities: { id: string; label: string; categorical: Record<string, string[]> }[];
  };
  // One identity is not a choice, and the panel hides itself below two anyway — returning `[]` keeps
  // "the host published nothing" and "the host published one" the same answer, which is what the
  // provider's retirement guard already assumes.
  if (document.identities.length < 2) return [];
  return document.identities.map((identity) => ({
    value: identity.id,
    label: identity.label,
    swatches: {
      light: identity.categorical.light ?? [],
      dark: identity.categorical.dark ?? [],
    },
  }));
}
