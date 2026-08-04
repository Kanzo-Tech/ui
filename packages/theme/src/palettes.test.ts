import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PALETTE_SEEDS,
  SYNTAX_ROLES,
  TEXT_MIN,
  compile,
  contrastRatio as contrast,
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

/** Split once at the first occurrence of `marker`, keeping it at the head of the second part. */
function splitAt(source: string, marker: string): [string, string] {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`tokens.css has no ${marker}`);
  return [source.slice(0, at), source.slice(at)];
}

/**
 * The Tailwind registration `gen-palette.mjs` writes, rebuilt from the same two facts it uses.
 *
 * Rebuilt rather than imported, because the generator is a script and this is the only thing that
 * would notice it drifting: six families, twelve steps, twelve alphas. A copy that agreed with the
 * script by construction would assert nothing.
 */
function scaleRegistration(): string {
  const families = ["base", "brand", "destructive", "warning", "success", "info"];
  return [
    "@theme inline {",
    ...families.flatMap((family) => [
      ...Array.from({ length: 12 }, (_, i) => `  --color-${family}-${i + 1}: var(--${family}-${i + 1});`),
      ...Array.from({ length: 12 }, (_, i) => `  --color-${family}-a${i + 1}: var(--${family}-a${i + 1});`),
    ]),
    "}",
  ].join("\n");
}
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
    expect(KANZO.seeds.base).toBe(PALETTE_SEEDS.kanzo?.base);
  });

  it("is exactly what re-deriving its own seeds produces", () => {
    // The stored artefact is the thing that was reviewed, so a stale one is not an error — but a
    // stored one that no longer matches its seeds is, because the seeds are what the file claims it
    // came from. `derivePalette` is deterministic given `derivedAt`, so this is a byte comparison.
    const fresh = derivePalette({
      ...seedInput("kanzo", PALETTE_SEEDS.kanzo as { label: string; brand: string; base: string }),
      state: "published",
      derivedAt: KANZO.engine.derivedAt,
    });
    expect(fresh).toEqual(KANZO);
  });

  it("is what tokens.css paints with, byte for byte", () => {
    // This replaces every hand-written colour block and the three drift guards that used to watch
    // them. `tokens.css` had a `:root` and a `.dark` that were a manual copy of the generated
    // base scale and of the `kanzo` palette's syntax slots, with nothing tying them together —
    // so *selecting* Kanzo could recolour an editor that was already showing Kanzo. There is one
    // copy now, and this is it.
    const at = tokensCss.indexOf(MARKER);
    expect(at, "tokens.css has lost its generated-section marker").toBeGreaterThan(0);
    const generated = tokensCss.slice(tokensCss.indexOf("*/", at) + 2).trimStart();

    // Two parts, and the split is the one thing worth asserting about them. The `@theme inline`
    // block registers the reference layer with Tailwind so `bg-base-3` exists at all; it names
    // variables and never values, so it is the same 144 lines for every tenant and `compile()`
    // deliberately does not emit it — a tenant's document is served into a page whose CSS was built
    // long before, where an `@theme` block would register nothing.
    const [registration, document] = splitAt(generated, "/* kanzo —");
    expect(registration.trimEnd()).toBe(scaleRegistration());
    expect(document).toBe(compile(KANZO));
  });

  it("is the only document `tokens.css` carries, and the only one unscoped", () => {
    // The asymmetry the selection scheme rests on, restated for scoping: the default is `:root` in
    // `tokens.css` and every other document sits under its own `[data-palette]`, so a host ships all
    // of them and the attribute chooses. What used to be here — every non-default document elevated
    // by a redundant `:root` qualifier so it could beat the default on specificity — assumed only one
    // could be on the page at a time.
    expect(tokensCss).not.toContain("[data-palette=");
    for (const entry of paletteIndex.filter((p) => !p.isDefault)) {
      const css = readFileSync(resolve(pkgDir, "palettes", `${entry.id}.css`), "utf8");
      // Three members, each with a job: the qualified one beats `tokens.css`'s own `:root` on
      // `<html>`; the bare one reaches a preview div, where `:root` cannot match at all; and
      // `.light` is what lets that div force light inside a dark page.
      expect(css, entry.id).toContain(
        `[data-palette="${entry.id}"]:root, [data-palette="${entry.id}"], [data-palette="${entry.id}"].light {`,
      );
      expect(css, entry.id).toContain(`[data-palette="${entry.id}"].dark:root`);
      // No appearance selector reaches for an ancestor — that descendant is what made a light scope
      // inside a dark page impossible. See `compile.ts`'s `scopeOf`.
      expect(css, entry.id).not.toContain(`.dark [data-palette="${entry.id}"]`);
      expect(css, `${entry.id} would paint every document`).not.toMatch(/^:root \{/m);
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
    expect(multi[0]?.seeds.baseHueFrom).not.toBe("brand");
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
      expect(entry.seeds, entry.id).toEqual({ brand: doc.seeds.brand, base: doc.seeds.base });
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

/**
 * Every document, re-measured off the bytes it ships.
 *
 * This suite exists because of what it found. `--faint` was bound to a hard-coded `step(neutral, 10)`
 * and **two of the six shipped documents failed AA there** — Nord in dark at 3.48:1 and Catppuccin
 * Latte in light at 3.37:1 — which is unreadable placeholder text and unreadable editor gutter
 * numbers, in palettes a user can select today.
 *
 * Nothing caught it, and the reason is the shape of the old tests rather than an oversight: every
 * contrast assertion in this repo resolved roles against **one** set of ramps, the default tenant's,
 * and Kanzo's own neutral is comfortable at 5.18/4.74. A per-tenant verdict needs a per-tenant
 * measurement, which is what `derivePalette`'s cross-checks are for — and `--faint` had no row.
 *
 * So this reads the **emitted CSS**, not the documents and not the derivation: a gate that shares
 * the generator's arithmetic cannot catch the generator being wrong, which is the same reason
 * `checkRamp` re-measures a ramp it has just produced.
 */
describe("every shipped document, measured off its own stylesheet", () => {
  /** The block that declares this mode — by its own `color-scheme`, not by guessing the selector. */
  const blockFor = (css: string, mode: "light" | "dark"): string => {
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const body = rule[2] as string;
      if (new RegExp(`color-scheme:\\s*${mode}\\b`).test(body)) return body;
    }
    throw new Error(`no ${mode} block`);
  };
  const tokenIn = (body: string, token: string): string => {
    const found = body.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]+)`))?.[1];
    if (!found) throw new Error(`--${token} not declared`);
    return found;
  };

  const sheets = paletteIndex.map((entry) => ({
    id: entry.id,
    css: readFileSync(
      resolve(pkgDir, entry.isDefault ? "tokens.css" : `palettes/${entry.id}.css`),
      "utf8",
    ),
  }));

  it("keeps the quietest ink at AA on its own page, in both modes", () => {
    for (const { id, css } of sheets) {
      for (const mode of ["light", "dark"] as const) {
        const body = blockFor(css, mode);
        expect(
          contrast(tokenIn(body, "faint"), tokenIn(body, "background")),
          `${id} ${mode}: --faint on --background`,
        ).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    }
  });

  it("keeps every syntax role at AA on its own active line, in both modes", () => {
    // The ground is `--editor-active-line`, not `--background`, and that is the whole finding: the
    // gate that shipped measured the page, and `--kanzo-syntax-type` reached production at 4.30:1 on
    // a line being edited. Step 3 is the harder surface in both modes, so this covers the page too.
    for (const { id, css } of sheets) {
      for (const mode of ["light", "dark"] as const) {
        const body = blockFor(css, mode);
        const ground = tokenIn(body, "muted");
        for (const role of SYNTAX_ROLES) {
          expect(
            contrast(tokenIn(body, `syntax-${role}`), ground),
            `${id} ${mode}: --syntax-${role} on --editor-active-line`,
          ).toBeGreaterThanOrEqual(TEXT_MIN);
        }
      }
    }
  });

  it("gives each document a syntax of its own", () => {
    // **The assertion that would have caught the bug that opened all of this.** `SYNTAX_SOURCE` was
    // a constant — `{ light: "kanzo", dark: "kanzo-dark" }` — so all six documents declared the same
    // 26 values and choosing Dracula gave you Dracula's surfaces with Kanzo's keywords, while
    // Dracula's own base16 slots sat unread in the data file.
    //
    // The claim is deliberately weak — *not all identical* rather than *all distinct* — because two
    // tenants seeded from the same scheme SHOULD agree, and a document with no scheme of its own
    // correctly falls back to Kanzo's. What must never be true again is that the source is ignored.
    for (const mode of ["light", "dark"] as const) {
      const keywords = new Set(
        sheets.map(({ css }) => tokenIn(blockFor(css, mode), "syntax-keyword")),
      );
      expect(keywords.size, `${mode}: every document declares the same --syntax-keyword`).toBeGreaterThan(1);
    }
    // Named, so the test says which palettes it is actually about rather than just counting.
    const dark = (id: string) =>
      tokenIn(blockFor(sheets.find((s) => s.id === id)?.css as string, "dark"), "syntax-keyword");
    expect(dark("dracula")).toBe("#ff79c6");
    expect(dark("nord")).toBe("#b48ead");
    expect(dark("kanzo")).toBe("#c27aff");
  });

  it("carries no `--kanzo-` prefixed COLOUR token", () => {
    // The prefix was a leftover from when syntax and the editor's surfaces were "the editor's
    // private tokens", which stopped being true the moment a document started deriving them. Every
    // other role in the table is unprefixed.
    //
    // Scoped to colour on purpose. `tokens.css` still declares `--kanzo-font-size-base`,
    // `-small`, `-xs` and `--kanzo-focus-ring` in its hand-written half — those are typography and
    // focus, not part of the role table, and renaming them is a different question from this one.
    for (const { id, css } of sheets) {
      for (const dead of ["--kanzo-syntax-", "--kanzo-editor-", "--kanzo-gutter-"]) {
        expect(css, `${id} still declares ${dead}`).not.toContain(dead);
      }
    }
  });
});
