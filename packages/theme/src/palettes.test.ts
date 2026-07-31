import { existsSync, readFileSync } from "node:fs";
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
 */

const pkgDir = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(pkgDir, "tokens.css"), "utf8");
const KANZO = kanzoJson as unknown as TenantPalette;

describe("the default tenant's document", () => {
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
    const at = tokensCss.indexOf("/* ── GENERATED BELOW");
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
    const head = tokensCss.slice(0, tokensCss.indexOf("/* ── GENERATED BELOW"));
    const literals = [...head.matchAll(/#[0-9a-fA-F]{3,8}\b|color-mix\(|oklch\(/g)].map((m) => m[0]);
    expect(literals).toEqual([]);
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
