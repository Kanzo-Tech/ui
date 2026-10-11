import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { contrast } from "@kanzo-tech/theme";
import { describe, expect, it } from "vitest";
import { greyoutOpacity, NON_TEXT_CONTRAST, type Rgb } from "./greyout";

/**
 * **The greyout, against every shipped theme** (`/docs/design/crossfilter#the-greyout`). The oracle is
 * not the module under test: the tokens are read from `@kanzo-tech/theme`'s own CSS, contrast is
 * `@kanzo-tech/theme`'s `contrast` — the WCAG ratio its theme gate audits with — over the 8-bit hex a
 * screen shows, and the greyed colour is cosmos.gl 3.4.0's shader (`dist/index.js:5239-5256`),
 * written out here from it.
 */

const themes = (() => {
  const dir = dirname(createRequire(import.meta.url).resolve("@kanzo-tech/theme/themes/kanzo.css"));
  return readdirSync(dir)
    .filter((file) => file.endsWith(".css"))
    .map((file) => {
      const css = readFileSync(join(dir, file), "utf8");
      const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      const capacity = Number(css.match(/--chart-capacity:\s*(\d+)/)?.[1] ?? 8);
      const charts = Array.from({ length: capacity }, (_, i) => token(`chart-${i + 1}`)).filter((c): c is string => c !== undefined);
      // What the canvas paints: a category's colour, or the muted ink for the categories past capacity.
      return { name: file.replace(/\.css$/, ""), background: token("background")!, colours: [...charts, token("muted-foreground")!] };
    });
})();

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Rgb;
const toHex = (c: Rgb) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;

/** cosmos.gl's greyed point, from its shader, at `alpha` over the background, as the screen's hex. */
function shown(colour: string, background: string, alpha: number): string {
  const [c, b] = [rgb(colour), rgb(background)];
  const dark = 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2] < 0.65;
  const target = dark ? [0.2, 0.2, 0.2] : b.map((v) => Math.max(v, 0.8));
  const greyed = c.map((v, i) => v + (target[i]! - v) * 0.65);
  return toHex(greyed.map((g, i) => alpha * g + (1 - alpha) * b[i]!) as unknown as Rgb);
}

/** The criterion at `alpha`, for every colour that is itself at 3 : 1 to the background. */
const holds = (theme: (typeof themes)[number], alpha: number) =>
  theme.colours
    .filter((c) => contrast(c, theme.background) >= NON_TEXT_CONTRAST)
    .every((c) => contrast(c, shown(c, theme.background, alpha)) >= NON_TEXT_CONTRAST);

describe("the greyout, per theme", () => {
  it("reads all eight shipped themes", () => {
    expect(themes.map((t) => t.name).sort()).toEqual(["catppuccin-latte", "catppuccin-mocha", "kanzo", "kanzo-dark", "lofi", "lofi-dark", "nord", "nord-dark"]);
  });

  it.each(themes.map((t) => [t.name, t] as const))(
    "%s: keeps every kept colour at 3 : 1 from itself greyed, at the opacity and every one below it, no larger opacity does, and greyed stays visible",
    (_, theme) => {
      const alpha = greyoutOpacity(theme.colours.map(rgb), rgb(theme.background));
      // Every opacity up to α, in the thousandths it is searched in, holds the criterion …
      for (let k = 0; k <= Math.round(alpha * 1000); k++) expect(holds(theme, k / 1000), `${theme.name} at ${k / 1000}`).toBe(true);
      // … and the next one breaks it, unless α is already full opacity.
      if (alpha < 1) expect(holds(theme, alpha + 0.001), `${theme.name} at ${alpha + 0.001}`).toBe(false);
      // And greyed never reads as hidden: every greyed mark is distinguishable from the background.
      for (const c of theme.colours) expect(contrast(shown(c, theme.background, alpha), theme.background), `${theme.name} ${c}`).toBeGreaterThan(1);
    },
  );

  it("keeps cosmos.gl's full opacity when no colour can be told from the background, since there is nothing to protect", () => {
    expect(greyoutOpacity([rgb("#fafafa")], rgb("#ffffff"))).toBe(1);
  });
});
