import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

// DESIGN.md: "Logical properties, never physical … One code path mirrors correctly under RTL."
// A rule nobody can grep is a rule that decays, so this is the grep. The three layers only:
// `charts/` is SVG plot geometry, `table/` and `theme/` are not appearance, and `lib/` has no JSX.
// `composites/` IS scanned in full, CodeMirror overrides included.
const LAYERS = ["simples", "composites", "layouts"];

const PHYSICAL =
  /(?:^|[\s"`:[])(-?(?:ml|mr|pl|pr|left|right)-[\w./[\]()%-]+|border-[lr](?:-[\w.[\]()-]+)?|rounded-[lr]-[\w.[\]()-]+|text-(?:left|right))(?![\w-])/g;

/**
 * Every physical utility that is NOT a violation, with the reason it survives review. An entry
 * here is a claim that the value does not depend on reading direction — if you add one, say why.
 */
const ALLOWED: Record<string, string[]> = {
  // Centring, not sidedness: `left-1/2` is undone by `-translate-x-1/2`.
  "simples/calendar.tsx": ["left-1/2"],
  // Ark measures the indicator into `--left`/`--width` as physical pixels, so the utility that
  // consumes them must be physical too. Mirroring needs Ark to publish logical vars first.
  "simples/segment-group.tsx": ["left-(--left)", "right-[calc(var(--left)", "border-l"],
  // Shark's own RTL handling: the physical default is paired with an explicit `rtl:` override.
  "simples/table.tsx": ["text-left", "text-right"],
  // Ark's viewport offsets are physical measurements of the toast region.
  "simples/toast.tsx": ["left-[calc(var(--viewport-offset-right)/2)]"],
};

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function scan() {
  const found: string[] = [];
  for (const layer of LAYERS) {
    const dir = join(SRC, layer);
    for (const file of readdirSync(dir)) {
      if (!/\.tsx?$/.test(file) || file.includes(".test.")) continue;
      const key = `${layer}/${file}`;
      const source = stripComments(readFileSync(join(dir, file), "utf8"));
      for (const match of source.matchAll(PHYSICAL)) {
        const hit = match[1] ?? "";
        if (ALLOWED[key]?.some((ok) => hit.startsWith(ok))) continue;
        found.push(`${key}: ${hit}`);
      }
    }
  }
  return [...new Set(found)].sort();
}

describe("logical properties", () => {
  it("uses no physical direction utility outside the reviewed allowlist", () => {
    // Failing? Use the logical twin — ms/me, ps/pe, start/end, border-s/border-e,
    // rounded-s/rounded-e, text-start/text-end — or add an entry to ALLOWED with a reason.
    expect(scan()).toEqual([]);
  });
});
