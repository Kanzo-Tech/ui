import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PALETTE_SEEDS,
  compile,
  derivePalette,
  seedInput,
  type TenantPalette,
} from "@kanzo-tech/palette";
import { paletteIndex } from "./index.js";
import kanzoJson from "../palettes/kanzo.json";

/**
 * The document the product paints with.
 *
 * `palettes/kanzo.json` is not a special case — it is a tenant whose document happens to be
 * committed, and `tokens.css`'s colour half is that document compiled. So the claims here are that
 * the stored artefact is what its own seeds produce, and that the sheet is what the artefact
 * compiles to. The old file held nine tests about pairing, appearance, declared brand/status roles
 * and manufactured slots; none of those concepts exists any more.
 *
 * The derivation is imported from `@kanzo-tech/palette`, a **devDependency** — see
 * `boundary.test.ts`, which is what keeps it one. What the shipped seeds themselves survive is
 * checked over there.
 *
 * ## What this guard cannot prove
 *
 * - **It checks the one committed document, and asserts that there is only one.** The corpus test
 *   below is the whole defence: a second palette added to `palettes/` would otherwise be compiled
 *   into nothing and checked by nobody, and this file would keep passing. It has to fail so that
 *   whoever adds the second one decides what "the sheet is the document compiled" then means.
 * - **It compares text, and measures no colour.** Whether the document reads at AA, whether the
 *   categorical set separates under CVD, whether the ramps are monotonic — none of that is here.
 *   `@kanzo-tech/palette`'s own checks own all of it, and this file would happily agree that a
 *   sheet is the faithful compilation of a bad document.
 * - **"Deterministic given `derivedAt`" is asserted once, on one seed pair.** The general claim is
 *   `derive-palette.test.ts`'s.
 * - **The hand-written half is checked for colour notation, not for correctness.** A radius, a font
 *   size or a utility declared wrongly above the marker passes; what cannot pass is a colour.
 */

const pkgDir = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(pkgDir, "tokens.css"), "utf8");
const KANZO = kanzoJson as unknown as TenantPalette;
const MARKER = "/* ── GENERATED BELOW";

/**
 * Every notation that can carry a colour, not just the three the first cut of this rule listed.
 *
 * The hex arm takes 3, 4, 6 and 8 digits. With a trailing `\b` — which is what it had — a four- or
 * eight-digit literal followed by anything word-like was invisible, which is the same hole
 * `no-literal-hues.test.ts` carried on the other side of the boundary.
 */
const COLOUR_NOTATION =
  /(?<![&0-9a-zA-Z])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/g;

describe("the default tenant's document", () => {
  it("is the only palette the sheet carries, and the sheet has a generated half", () => {
    // This used to read `toEqual(["kanzo.json"])` — a corpus of one, said out loud, because a second
    // document would have been checked by nothing while this file reported green. The corpus is six
    // now, so the guard is stated against the registry instead of against a literal: a file may sit
    // in `palettes/` only if `index.json` accounts for it. The registry itself is held against
    // `PALETTE_SEEDS` next door, which is the other half — that one catches an entry with no file,
    // this one catches a file with no entry.
    const expected = [
      "index.json",
      ...paletteIndex.flatMap((p) => (p.isDefault ? [`${p.id}.json`] : [`${p.id}.json`, `${p.id}.css`])),
    ].sort();
    const stored = readdirSync(resolve(pkgDir, "palettes")).sort();
    expect(
      stored,
      "a palette was added to palettes/ and nothing checks it — extend this file to cover it",
    ).toEqual(expected);

    const at = tokensCss.indexOf(MARKER);
    expect(at, "tokens.css has lost its generated-section marker").toBeGreaterThan(0);
    // Both halves have to be substantial, because an empty half compares equal to an empty half.
    expect(at, "tokens.css has no hand-written half left").toBeGreaterThan(200);
    expect(
      tokensCss.length - at,
      "tokens.css has almost no generated half — the compile emitted nothing",
    ).toBeGreaterThan(1000);
  });

  it("is a tenant like any other, whose document happens to be committed", () => {
    expect(KANZO.id).toBe("kanzo");
    expect(KANZO.state).toBe("published");
    expect(KANZO.seeds.brand).toBe(PALETTE_SEEDS.kanzo?.brand);
    expect(KANZO.seeds.neutral).toBe(PALETTE_SEEDS.kanzo?.neutral);
  });

  it("is exactly what re-deriving its own seeds produces", () => {
    // The stored artefact is the thing that was reviewed, so a stale one is not an error — but a
    // stored one that no longer matches its seeds is, because the seeds are what the file claims it
    // came from. `derivePalette` is deterministic given `derivedAt`, so this is a byte comparison.
    const fresh = derivePalette({
      ...seedInput("kanzo", PALETTE_SEEDS.kanzo as { label: string; brand: string; neutral: string }),
      state: "published",
      derivedAt: KANZO.engine.derivedAt,
    });
    expect(fresh).toEqual(KANZO);
  });

  it("is what tokens.css paints with, byte for byte", () => {
    // This replaces every hand-written colour block and the three drift guards that used to watch
    // them. `tokens.css` had a `:root` and a `.dark` that were a manual copy of the generated
    // neutral scale and of the `kanzo` palette's syntax slots, with nothing tying them together —
    // so *selecting* Kanzo could recolour an editor that was already showing Kanzo. There is one
    // copy now, and this is it.
    const at = tokensCss.indexOf(MARKER);
    expect(at, "tokens.css has lost its generated-section marker").toBeGreaterThan(0);
    const generated = tokensCss.slice(tokensCss.indexOf("*/", at) + 2).trimStart();
    expect(generated).toBe(compile(KANZO));
  });

  it("is the only document `tokens.css` carries, and the only one not elevated", () => {
    // The asymmetry the selection scheme rests on: the default arrives as `tokens.css` at (0,1,0)
    // and every other document is inlined after it, elevated by one qualifier, so it wins on
    // specificity instead of on which stylesheet the browser happened to see last.
    expect(tokensCss).not.toContain(":root:root");
    for (const entry of paletteIndex.filter((p) => !p.isDefault)) {
      const css = readFileSync(resolve(pkgDir, "palettes", `${entry.id}.css`), "utf8");
      expect(css, entry.id).toContain(":root:root {");
      expect(css, entry.id).toContain(".dark:root {");
    }
  });

  it("leaves no hand-written colour above the generated section", () => {
    // The house rule, enforced where it is easiest to break: a hex that is not traceable to a seed
    // through a published rule is a defect. The hand-written half is Tailwind's utility surface,
    // the radius scale and the font sizes — no value, no mix, no literal.
    const head = tokensCss.slice(0, tokensCss.indexOf(MARKER));
    const literals = [...head.matchAll(COLOUR_NOTATION)].map((m) => m[0]);
    expect(
      literals,
      `A colour above the marker is a colour no seed produced and no rule can change. Move it into\n` +
        `the derivation, or bind it to a role:\n${literals.join("\n")}`,
    ).toEqual([]);
  });

  it("would catch a hand-written colour in any notation", () => {
    // Eleven alternations are eleven chances to write one that matches nothing.
    for (const notation of [
      "#fff",
      "#fff3",
      "#8e51ff",
      "#8e51ffcc",
      "rgb(1 2 3)",
      "rgba(1,2,3,.5)",
      "hsl(1 2% 3%)",
      "hwb(1 2% 3%)",
      "lab(1% 2 3)",
      "lch(1% 2 3)",
      "oklab(1 2 3)",
      "oklch(1 2 3)",
      "color(srgb 1 0 0)",
      "color-mix(in oklch, a, b)",
    ]) {
      COLOUR_NOTATION.lastIndex = 0;
      expect(COLOUR_NOTATION.test(notation), `${notation} was not read as a colour`).toBe(true);
    }

    for (const innocent of [
      "--radius: 0.625rem;",
      "@theme inline {",
      "&#8230;",
      "translate(1px)",
      "var(--primary)",
      "calc(100% - 2px)",
    ]) {
      COLOUR_NOTATION.lastIndex = 0;
      expect(COLOUR_NOTATION.test(innocent), `${innocent} was read as a colour`).toBe(false);
    }
    COLOUR_NOTATION.lastIndex = 0;
  });
});

/**
 * The registry — five documents a tenant could publish, and what a control needs to offer them.
 *
 * It is generated beside the documents by the same script, so the risk it carries is the one every
 * derived index carries: agreeing with nothing. These assertions hold it against the documents
 * themselves rather than against a second copy of the expected values.
 */
describe("the palette registry", () => {
  it("has an entry per shipped document, and exactly one default", () => {
    // The five seed pairs plus `bank`, which is not a seed pair: it is the one tenant that publishes
    // two brands, and it exists because `identity` was otherwise a capability with no instance —
    // fully built, fully tested and impossible to see.
    expect(paletteIndex.map((p) => p.id).sort()).toEqual([...Object.keys(PALETTE_SEEDS), "bank"].sort());
    expect(paletteIndex.filter((p) => p.isDefault).map((p) => p.id)).toEqual(["kanzo"]);
  });

  it("ships exactly one document with more than one identity", () => {
    // Asserted as a property of the SET, not of `bank` alone: the point is that a multi-identity
    // document exists to look at, and that the other five stay single-brand — a shipped seed pair
    // publishing two would mean `seedInput` had quietly grown a second shape.
    const multi = paletteIndex
      .map((entry) => JSON.parse(
        readFileSync(resolve(pkgDir, "palettes", `${entry.id}.json`), "utf8"),
      ) as TenantPalette)
      .filter((doc) => doc.identities.length > 1);

    expect(multi.map((doc) => doc.id)).toEqual(["bank"]);
    expect(multi[0]?.identities.map((i) => i.id)).toEqual(["retail", "private"]);
    // A multi-identity document must carry an explicit neutral rather than inheriting the brand's
    // hue — `derivePalette` refuses otherwise, and this is what that refusal protects.
    expect(multi[0]?.seeds.neutralHueFrom).not.toBe("brand");
  });

  it("previews what the page will paint, not what a chart would", () => {
    // What a picker draws has to be what the page will look like, or the card is a decoration that
    // lies. It used to draw the CATEGORICAL set — eight colours nobody has seen yet — and six cards
    // built from chart wheels all read as the same card. Four role colours instead: the surface, the
    // ink, the brand's own `--primary` and the border, which is what tells Dracula from Nord.
    for (const entry of paletteIndex) {
      const doc = JSON.parse(
        readFileSync(resolve(pkgDir, "palettes", `${entry.id}.json`), "utf8"),
      ) as TenantPalette;
      const identity = doc.identities.find((i) => i.id === doc.defaultIdentity);
      expect(entry.label, entry.id).toBe(doc.label);
      expect(entry.seeds, entry.id).toEqual({ brand: doc.seeds.brand, neutral: doc.seeds.neutral });
      expect(entry.capacity, entry.id).toBe(identity?.categorical.capacity);

      for (const mode of ["light", "dark"] as const) {
        expect(entry.swatches[mode], `${entry.id} ${mode}`).toEqual([
          doc.roles[mode]["--background"],
          doc.roles[mode]["--foreground"],
          identity?.roles[mode]["--primary"],
          doc.roles[mode]["--border"],
        ]);
      }
    }
  });

  it("nests each document's brands, default first", () => {
    // The containment, in the data. `defaultIdentity` has to be FIRST rather than merely present:
    // the provider reads `children[0]` as the one `:root` paints, which is how an empty preference
    // resolves to something on screen.
    for (const entry of paletteIndex) {
      const doc = JSON.parse(
        readFileSync(resolve(pkgDir, "palettes", `${entry.id}.json`), "utf8"),
      ) as TenantPalette;
      expect(entry.identities.map((i) => i.id), entry.id).toEqual(doc.identities.map((i) => i.id));
      expect(entry.identities[0]?.id, entry.id).toBe(doc.defaultIdentity);
      // Each brand previews ITSELF: the wheel is spun from its own hue, so a strip taken from the
      // document would picture every card identically and the control would look broken.
      for (const identity of entry.identities) {
        const source = doc.identities.find((i) => i.id === identity.id);
        expect(identity.swatches.light[2], `${entry.id}/${identity.id}`)
          .toBe(source?.roles.light["--primary"]);
      }
    }
  });

  it("gives the default no stylesheet of its own", () => {
    // `tokens.css` IS Kanzo compiled. A second copy would be a second thing to keep in step, for a
    // reader that does not exist — and a host importing it would load the same document twice.
    expect(existsSync(resolve(pkgDir, "palettes", "kanzo.css"))).toBe(false);
  });
});
