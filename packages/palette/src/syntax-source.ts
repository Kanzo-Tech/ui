import paletteDataJson from "../palette-data.json";
import type { Mode } from "./palette-check.js";
import { SYNTAX_ROLES, type SyntaxRole, type SyntaxSeeds } from "./derive-syntax.js";

/**
 * Where a tenant's syntax colours come in from — one entry point, three adapters.
 *
 * A client may already have a scheme, and the useful question is never "is it in our format" but
 * "what are its seven hues". So each adapter's whole job is to answer that; `deriveSyntax` then
 * solves lightness and chroma against *this* tenant's editor, which is what makes an imported scheme
 * legible on a page its authors never saw.
 *
 * This is the same treatment `seeds.ts` gives a base16 palette's brand and base seeds, stated once
 * more because it is the part people expect to be a transcription: **a foreign scheme keeps its hue
 * and loses its mood.** Dracula on a light document is a reading, not a copy of dark hexes onto
 * white.
 */

/** base16's accent slots, in the order this system's roles read them. */
const BASE16_SLOT: Record<SyntaxRole, string> = {
  keyword: "base0E",
  string: "base0B",
  function: "base0D",
  type: "base0A",
  number: "base09",
  property: "base0C",
  identifier: "base08",
};

const PALETTES = paletteDataJson.palettes as unknown as Record<
  string,
  { slots: Record<string, string> }
>;

/**
 * A base16 palette, by id — the five this package ships, or any well-formed one.
 *
 * base16 assigns meanings to its eight accent slots (base08 variables, base09 constants, base0A
 * classes, base0B strings, base0C support, base0D functions, base0E keywords), and those meanings
 * are what the mapping above encodes. base0F — deprecated/invalid — has no entry, because `invalid`
 * is a *state* and dissolved into the destructive family.
 *
 * `mode` picks the variant when a scheme ships both halves under separate ids, which is how base16
 * distributes them: Kanzo's own light and dark sets are `kanzo` and `kanzo-dark`. A scheme with only
 * one half is used for both, and `SYNTAX_BAND` does the rest.
 */
/**
 * Whether a base16 palette by that name ships here.
 *
 * Exists because an id means two different things depending on where it came from: the five
 * palettes this package ships ARE base16 schemes, so their id names a syntax set; an id derived
 * from a seed pair somebody typed names nothing. `seedInput` has to be able to tell.
 */
export function hasBase16(id: string): boolean {
  return PALETTES[id] !== undefined;
}

export function fromBase16(id: string, mode: Mode): SyntaxSeeds {
  const dark = PALETTES[`${id}-dark`];
  const palette = (mode === "dark" && dark ? dark : PALETTES[id]) ?? PALETTES[id];
  if (!palette) throw new Error(`no base16 palette "${id}" — the syntax set would ship a hole`);
  return Object.fromEntries(
    SYNTAX_ROLES.map((role) => [role, palette.slots[BASE16_SLOT[role]] as string]),
  ) as SyntaxSeeds;
}

/**
 * A VS Code / TextMate theme, by its `tokenColors`.
 *
 * The scopes below are the ones every TextMate grammar agrees on, which is the only reason this can
 * be one function rather than a per-theme table. A scope a theme does not style falls back to
 * Kanzo's own seed for that role rather than to nothing: a hole in a syntax set is a role rendered
 * as plain text, which reads as a bug in the editor rather than as a gap in the import.
 */
export interface TokenColor {
  scope?: string | string[];
  settings?: { foreground?: string };
}

const TEXTMATE_SCOPE: Record<SyntaxRole, string[]> = {
  keyword: ["keyword", "keyword.control", "storage.type"],
  string: ["string", "string.quoted"],
  function: ["entity.name.function", "support.function"],
  type: ["entity.name.type", "support.type", "entity.name.class"],
  number: ["constant.numeric", "constant.language"],
  property: ["variable.other.property", "support.variable", "entity.name.tag"],
  identifier: ["variable", "variable.other"],
};

export function fromVsCode(tokenColors: TokenColor[], mode: Mode): SyntaxSeeds {
  const byScope = new Map<string, string>();
  for (const entry of tokenColors) {
    const foreground = entry.settings?.foreground;
    if (!foreground) continue;
    const scopes = typeof entry.scope === "string" ? entry.scope.split(",") : (entry.scope ?? []);
    for (const scope of scopes) {
      const key = scope.trim();
      if (key && !byScope.has(key)) byScope.set(key, foreground);
    }
  }
  const fallback = fromBase16("kanzo", mode);
  return Object.fromEntries(
    SYNTAX_ROLES.map((role) => [
      role,
      TEXTMATE_SCOPE[role].map((scope) => byScope.get(scope)).find(Boolean) ?? fallback[role],
    ]),
  ) as SyntaxSeeds;
}

/** Seven colours given directly — the escape hatch for a client whose scheme is neither format. */
export function fromHexes(hexes: Partial<SyntaxSeeds>, mode: Mode): SyntaxSeeds {
  const fallback = fromBase16("kanzo", mode);
  return Object.fromEntries(
    SYNTAX_ROLES.map((role) => [role, hexes[role] ?? fallback[role]]),
  ) as SyntaxSeeds;
}

/**
 * What a document records about where its syntax came from.
 *
 * A reference and not the seven values, for the reason `seeds` is a pair and not a ramp set: the
 * document should say what it was *asked for*, so a re-derivation under changed obligations produces
 * the same intent rather than re-deriving from its own output.
 */
export type SyntaxSourceRef =
  | { kind: "base16"; id: string }
  | { kind: "hexes"; hexes: Partial<SyntaxSeeds> };

/** The default: Kanzo's own base16 slots, which is what every document used to carry outright. */
export const DEFAULT_SYNTAX_SOURCE: SyntaxSourceRef = { kind: "base16", id: "kanzo" };

export function seedsFor(source: SyntaxSourceRef, mode: Mode): SyntaxSeeds {
  return source.kind === "base16" ? fromBase16(source.id, mode) : fromHexes(source.hexes, mode);
}
