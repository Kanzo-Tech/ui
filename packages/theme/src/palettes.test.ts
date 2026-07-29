import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PALETTE_SEEDS,
  compile,
  derivePalette,
  seedInput,
  type TenantPalette,
} from "@kanzo-tech/palette";
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

  it("leaves no hand-written colour above the generated section", () => {
    // The house rule, enforced where it is easiest to break: a hex that is not traceable to a seed
    // through a published rule is a defect. The hand-written half is Tailwind's utility surface,
    // the radius scale and the font sizes — no value, no mix, no literal.
    const head = tokensCss.slice(0, tokensCss.indexOf("/* ── GENERATED BELOW"));
    const literals = [...head.matchAll(/#[0-9a-fA-F]{3,8}\b|color-mix\(|oklch\(/g)].map((m) => m[0]);
    expect(literals).toEqual([]);
  });
});
