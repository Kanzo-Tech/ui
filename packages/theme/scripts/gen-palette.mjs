/*
 * gen-palette.mjs — derives the default tenant's palette document and compiles it into tokens.css.
 *
 * The Kanzo document is not a special case. It is `derivePalette` applied to two seeds
 * (`themeData.seeds.kanzo`), exactly as a client's is, stored at `palettes/kanzo.json` and
 * compiled into the bottom of `tokens.css`. That is what "the default tenant is a tenant whose
 * document happens to be committed" means, and it is why no colour in this package is written by
 * hand.
 *
 * `derivedAt` is pinned rather than stamped with `Date.now()`: the artefact is checked in, and a
 * timestamp would make every regeneration a diff. Bump it when the seeds or the engine change.
 *
 * Reads `@kanzo-tech/palette`'s build output, so that package must be built first — the derivation
 * is TypeScript and this is plain Node. `pnpm --filter @kanzo-tech/theme gen` chains the two in
 * order. The import is resolved rather than reached for by relative path so the dependency shows up
 * as what it is: a devDependency of this package, never a runtime one.
 *
 * Run: node packages/theme/scripts/gen-palette.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { derivePalette, compile, PALETTE_SEEDS, KANZO_ID, seedInput } = await import(
  "@kanzo-tech/palette"
);

/** Pinned. Move it when the seeds or `OBLIGATIONS` move, never on an unrelated regeneration. */
const DERIVED_AT = "2026-07-29T00:00:00.000Z";

const doc = derivePalette({
  ...seedInput(KANZO_ID, PALETTE_SEEDS[KANZO_ID]),
  // The one document in the repo that is reviewed and shipped rather than proposed.
  state: "published",
  derivedAt: DERIVED_AT,
});

mkdirSync(join(ROOT, "palettes"), { recursive: true });
writeFileSync(join(ROOT, "palettes", "kanzo.json"), `${JSON.stringify(doc, null, 2)}\n`);

const MARKER = "/* ── GENERATED BELOW — do not edit by hand ";
const tokens = readFileSync(join(ROOT, "tokens.css"), "utf8");
const at = tokens.indexOf(MARKER);
if (at < 0) throw new Error("tokens.css has lost its generated-section marker");
const head = tokens.slice(0, at);
const banner = tokens.slice(at).split("*/")[0] + "*/";

writeFileSync(join(ROOT, "tokens.css"), `${head}${banner}\n\n${compile(doc)}`);
