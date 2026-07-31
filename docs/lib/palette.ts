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
 * The registry, narrowed to what a control needs — with each palette's brands nested inside it.
 *
 * This is the document → `SwatchOption[]` mapper `@kanzo-tech/theme` says a host writes, and the
 * nesting is the whole of it: a brand lives *inside* a document, so "which brands exist" is not a
 * second question answered beside "which palettes exist". The panel flattens the pair into one list
 * because one choice is what a user makes; the containment stays in the data because it is what
 * guarantees a tenant's brands share a neutral and remain one product.
 *
 * `children` is omitted for a single-brand palette rather than carrying a one-element array: one
 * entry is not a choice, and the panel would have to special-case it either way.
 *
 * Nothing here reads a document from disk any more. Everything a control needs — the labels, the
 * per-mode preview colours, the brands — is in `palettes/index.json`, generated beside the documents
 * by the same script. A `TenantPalette` carries seeds, ramps, categorical sets and record rows, and
 * `boundary.test.ts` keeps that type out of the client graph with a text match; the registry exists
 * so a host does not have to touch it.
 */
export const paletteOptions: SwatchOption[] = paletteIndex.map((entry) => ({
  value: entry.id,
  label: entry.label,
  swatches: entry.swatches,
  ...(entry.identities.length > 1
    ? {
        children: entry.identities.map((identity) => ({
          value: identity.id,
          label: identity.label,
          swatches: identity.swatches,
        })),
      }
    : {}),
}));
