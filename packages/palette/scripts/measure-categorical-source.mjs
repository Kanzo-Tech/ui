// Where a categorical set should be sourced from — the four candidates, measured.
//
//     node packages/palette/scripts/measure-categorical-source.mjs
//
// **The question.** A document lifted from a base16 palette has two things: a brand hue, and the
// eight accent slots the palette publishes. The syntax half reads the accents; the categorical half
// spins a wheel off the brand hue alone and never looks at them — so Dracula's charts are not
// Dracula's colours, while Dracula's keywords are. `decisions/…-categorical-source.md` is the record
// this feeds; the numbers live here because prose numbers rot (`decisions/a-count-belongs-in-a-script.md`).
//
// **What each column means.** `capacity` is how many real categories the set names. `light`/`dark`
// are the worst adjacent pair under CVD simulation, per mode; the search's own bar is
// `SEPARATION_BAR`, and the *score* it judges by is the lower of the two — so a row whose lower
// number is under the bar is a **refusal**, a best-effort set rather than one that cleared anything.
// `own` counts how many of the families the palette itself publishes survived: the identity the
// whole question is about, made countable.
import {
  BASE16_SLOTS,
  CATEGORICAL_LEADING,
  PALETTE_SEEDS,
  SEPARATION_BAR,
  STATUS_SEEDS,
  categoricalSource,
  deriveRamp,
  deriveSchemeColors,
  familyOf,
} from "../dist/index.js";

const MODES = ["light", "dark"];
const ACCENTS = ["base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"];
/** Documents lifted from a base16 palette — the only ones with authored accents to read. */
const BASE16 = ["dracula", "nord", "catppuccin-latte", "catppuccin-mocha"];

// What every set has to stay clear of: the four status fills at step 9, in both modes.
const avoid = [
  ...new Set(
    Object.values(STATUS_SEEDS).flatMap((seed) => MODES.map((mode) => deriveRamp(seed, mode).steps[8])),
  ),
];

const pad = (value, width) => String(value).padEnd(width);

console.log(`separation bar ${SEPARATION_BAR}; a score under it is a refusal\n`);
console.log(
  `${pad("document", 18)}${pad("option", 30)}${pad("cap", 5)}${pad("light", 7)}${pad("dark", 7)}${pad("own", 6)}${pad("ms", 8)}kept`,
);

for (const id of BASE16) {
  const brand = PALETTE_SEEDS[id].brand;
  const own = familyOf(brand);
  const options = { avoid, leading: CATEGORICAL_LEADING, require: own === null ? [] : [own] };

  const accents = [...new Set(ACCENTS.map((slot) => BASE16_SLOTS[id].slots[slot]).filter(Boolean))];
  const authored = [...new Set(accents.map((hex) => familyOf(hex)).filter((f) => f !== null))];
  const spun = categoricalSource(brand);

  // Deduplicated by family, the palette's own colour winning where both name one. The search's cost
  // is combinatorial in the family count, so this is not tidiness: it is the difference between
  // seconds and minutes, and it also stops one family being picked twice.
  const merged = new Map();
  for (const hex of [...accents, ...spun]) {
    const family = familyOf(hex);
    if (family !== null && !merged.has(family)) merged.set(family, hex);
  }
  const union = [...merged.values()];
  const required = [...new Set([...(own === null ? [] : [own]), ...authored])];

  const run = (label, source, extra = {}) => {
    const started = Date.now();
    const set = deriveSchemeColors(source, { ...options, ...extra });
    const ms = Date.now() - started;
    const light = set.separation.light ?? 0;
    const dark = set.separation.dark ?? 0;
    const kept = set.kept.filter((family) => authored.includes(family)).length;
    const refused = Math.min(light, dark) < SEPARATION_BAR ? "  REFUSAL" : "";
    console.log(
      `${pad(id, 18)}${pad(label, 30)}${pad(set.light.length, 5)}${pad(light.toFixed(1), 7)}${pad(dark.toFixed(1), 7)}${pad(`${kept}/${authored.length}`, 6)}${pad(ms, 8)}${set.kept.join(" ")}${refused}`,
    );
  };

  run("A wheel off the brand (today)", spun);
  run("B the palette's accents", accents);
  run("E union, own families required", union, { require: required });
  run("F union, own families offered", union);
  console.log("");
}
