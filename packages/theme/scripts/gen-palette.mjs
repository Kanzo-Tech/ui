/*
 * gen-palette.mjs — derives the default tenant's palette document and compiles it into tokens.css.
 *
 * The Kanzo document is not a special case. It is `derivePalette` applied to two seeds
 * (`themeData.seeds.kanzo`), exactly as a client's is, stored at `palettes/kanzo.json` and
 * compiled into the bottom of `tokens.css`. That is what "the default tenant is a tenant whose
 * document happens to be committed" means, and it is why no colour in this package is written by
 * hand.
 *
 * **One identity**, which `seedInput` already builds — Kanzo publishes a single brand, so the
 * compiled sheet carries `:root` and `.dark` and no `[data-identity]` block at all. A tenant that
 * published a second one would append two scoped blocks per extra brand and change nothing else,
 * which is the property that let sub-brands cost the common case nothing.
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
 *
 * Or author a tenant that is not one of the shipped seed pairs, writing beside them:
 *
 *   node packages/theme/scripts/gen-palette.mjs --id acme --label "Acme" \
 *     --brand '#2b7fff' --neutral '#6b7280' [--out ./somewhere]
 *
 * That mode writes ONE document and its stylesheet and leaves `tokens.css` and the registry alone —
 * `tokens.css` is the default tenant's and the registry is what this package publishes, neither of
 * which a client's document belongs in. It exists so "adding a client touches no code" is true of
 * this script too, and not only of the runtime it feeds.
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

mkdirSync(join(ROOT, "palettes"), { recursive: true });

/**
 * The four colours that make a palette recognisable, per mode — what a card in a picker draws.
 *
 * **Not the categorical set, which is what this used to be and was the least representative thing
 * available.** What tells Dracula from Nord at a glance is the surface and the brand; the chart wheel
 * is eight colours nobody has seen yet, so six cards built from it all looked like the same card.
 * daisyUI's own switcher draws four role colours for the same reason.
 *
 * `--primary` is read from the IDENTITY and the rest from the document, which is exactly the split
 * the model makes: a brand replaces the brand-derived slice and inherits every surface.
 */
function preview(document, identity) {
  const at = (mode) => [
    document.roles[mode]["--background"],
    document.roles[mode]["--foreground"],
    identity.roles[mode]["--primary"] ?? document.roles[mode]["--primary"],
    document.roles[mode]["--border"],
  ];
  return { light: at("light"), dark: at("dark") };
}

/** `--flag value` pairs, and nothing cleverer: four flags, no combining, no shorthand. */
function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) throw new Error(`expected a --flag, got ${key}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

const argv = flags(process.argv.slice(2));

if (argv.id || argv.brand || argv.neutral) {
  const missing = ["id", "brand", "neutral"].filter((key) => !argv[key]);
  if (missing.length) throw new Error(`--${missing.join(", --")} required when authoring a tenant`);

  const document = derivePalette({
    id: argv.id,
    label: argv.label ?? argv.id,
    neutral: argv.neutral,
    identities: [{ id: argv.id, label: argv.label ?? argv.id, brand: argv.brand }],
    // `draft`, not `published`: a document is published when somebody has read its record and
    // accepted what the gates moved. A script cannot do that on a client's behalf.
    state: "draft",
    derivedAt: DERIVED_AT,
  });

  const dir = argv.out ?? join(ROOT, "palettes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${argv.id}.json`), `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(join(dir, `${argv.id}.css`), compile(document, { elevate: true }));
  const { adjustments, relief } = document.record;
  console.log(
    `${argv.id}: ${adjustments.length} adjustment(s), ${relief.length} relief row(s) → ${dir}`,
  );
  process.exit(0);
}

/*
 * Every shipped seed pair, not just Kanzo's — a tenant may publish several palettes and the user
 * picks among them, so there has to be a set to pick from. Kanzo's is still the DEFAULT and the only
 * one compiled into `tokens.css`; the rest are written beside it as documents plus their own
 * stylesheet, imported by nothing and costing nothing until a host asks for one.
 *
 * The four borrowed ones are compiled with `elevate`, because that is the situation they exist for:
 * `tokens.css` is already on the page carrying Kanzo, and a chosen document arrives after it. Both
 * would be `:root` at (0,1,0) and the winner would be whichever the browser saw last.
 */
const index = [];
const doc = {};

for (const [id, seeds] of Object.entries(PALETTE_SEEDS)) {
  const isDefault = id === KANZO_ID;
  const document = derivePalette({
    ...seedInput(id, seeds),
    // Reviewed and shipped rather than proposed — true of all five, since all five are committed.
    state: "published",
    derivedAt: DERIVED_AT,
  });
  if (isDefault) doc.kanzo = document;

  writeFileSync(join(ROOT, "palettes", `${id}.json`), `${JSON.stringify(document, null, 2)}\n`);
  // The default's stylesheet IS `tokens.css`, written below. A second copy of it would be a second
  // thing to keep in step for no reader.
  if (!isDefault) {
    writeFileSync(join(ROOT, "palettes", `${id}.css`), compile(document, { elevate: true }));
  }

  const identity = document.identities.find((i) => i.id === document.defaultIdentity);
  index.push({
    id,
    label: document.label,
    isDefault,
    seeds: { brand: document.seeds.brand, neutral: document.seeds.neutral },
    swatches: preview(document, identity),
    capacity: identity.categorical.capacity,
    // The brands this document publishes, so a picker can offer them as part of the same choice
    // rather than as a second axis. One entry means "no choice here"; the panel reads it as such.
    identities: document.identities.map((brand) => ({
      id: brand.id,
      label: brand.label,
      swatches: preview(document, brand),
    })),
  });
}

/*
 * One tenant that is not a seed pair: a bank with a retail blue and a private gold.
 *
 * It exists because `identity` was the one capability in this package with no instance anywhere —
 * fully built, fully tested, and impossible to see, because every shipped seed pair publishes a
 * single brand. Kanzo could not be the demonstration: it is monochrome and single-brand on purpose,
 * and giving it a second marque would be fabricating branding for the company that owns this system.
 *
 * A multi-identity document REQUIRES an explicit neutral — `derivePalette` refuses otherwise — and
 * the refusal is the interesting part: the neutral is 90% of the pixels, so carrying the brand hue
 * into it would tint the whole product with the retail blue and then paint the private gold on top
 * of it, a decision the client never made in the field where it is hardest to see.
 */
const DEMO = {
  id: "bank",
  label: "Bank",
  neutral: "#6b7280",
  identities: [
    { id: "retail", label: "Retail", brand: "#2b7fff" },
    // "Private", not "Private Bank": the panel composes `${palette} · ${brand}` when a
    // tenant publishes more than one palette, and "Bank · Private Bank" says it twice.
    { id: "private", label: "Private", brand: "#a16207" },
  ],
};

const demo = derivePalette({ ...DEMO, state: "published", derivedAt: DERIVED_AT });
writeFileSync(join(ROOT, "palettes", `${DEMO.id}.json`), `${JSON.stringify(demo, null, 2)}\n`);
writeFileSync(join(ROOT, "palettes", `${DEMO.id}.css`), compile(demo, { elevate: true }));

const demoDefault = demo.identities.find((i) => i.id === demo.defaultIdentity);
index.push({
  id: demo.id,
  label: demo.label,
  isDefault: false,
  seeds: { brand: demo.seeds.brand, neutral: demo.seeds.neutral },
  swatches: preview(demo, demoDefault),
  capacity: demoDefault.categorical.capacity,
  identities: demo.identities.map((brand) => ({
    id: brand.id,
    label: brand.label,
    swatches: preview(demo, brand),
  })),
});

writeFileSync(join(ROOT, "palettes", "index.json"), `${JSON.stringify(index, null, 2)}\n`);

const MARKER = "/* ── GENERATED BELOW — do not edit by hand ";
const tokens = readFileSync(join(ROOT, "tokens.css"), "utf8");
const at = tokens.indexOf(MARKER);
if (at < 0) throw new Error("tokens.css has lost its generated-section marker");
const head = tokens.slice(0, at);
const banner = tokens.slice(at).split("*/")[0] + "*/";

// Not elevated, and that is the asymmetry the whole scheme rests on: this is the sheet everything
// else has to be able to beat.
writeFileSync(join(ROOT, "tokens.css"), `${head}${banner}\n\n${compile(doc.kanzo)}`);
