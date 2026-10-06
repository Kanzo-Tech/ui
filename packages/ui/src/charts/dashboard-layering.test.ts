import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The dashboard's layers, held by what each module imports.** Two claims, each a static import
 * closure — the modules a bundler must load before the entry runs:
 *
 * 1. **A read-only dashboard loads no editor.** `Dashboard` reaches `tile-editor.tsx` only through
 *    `React.lazy`, so the editor's modules and the parts only it draws with (`Select`, `RadioGroup`)
 *    stay out of `dashboard.tsx`'s closure.
 * 2. **The data model has no React in it.** The spec, the recommender and the kind table are plain
 *    TypeScript a server, a worker or `@kanzo-tech/ai` can run.
 *
 * What it cannot see: an import written other than `import … from "…"` or `export … from "…"` (a
 * `require`, a computed `import()`); `import type` is skipped on purpose, since it is erased. It
 * follows this package's relative imports only, so a dependency's own imports are not walked.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const STATIC = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm;

/** Every module `entry` loads statically: this package's relative paths, and bare package names. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(STATIC)) {
      if (!spec!.startsWith(".")) {
        seen.add(spec!);
        continue;
      }
      const base = resolve(dirname(file), spec!).replace(/\.js$/, "");
      const found = [".ts", ".tsx"].map((ext) => base + ext).find(existsSync);
      if (!found) throw new Error(`${file} imports ${spec}, which resolves to nothing`);
      visit(found);
    }
  };
  visit(join(HERE, entry));
  return seen;
}

const local = (set: Set<string>) => [...set].filter((p) => p.startsWith("/")).map((p) => p.slice(resolve(HERE, "..").length + 1));

describe("the dashboard's layers", () => {
  it("loads no editor for a read-only dashboard", () => {
    const loaded = local(closure("dashboard.tsx"));
    expect(loaded).toContain("charts/tile-views.tsx");
    // `Listbox` is not here: the filter bar's `FacetFilter` draws with it.
    const editor = ["charts/tile-editor.tsx", "charts/tile-fields.tsx", "charts/tile-controls.tsx", "simples/select.tsx", "simples/radio-group.tsx"];
    expect(loaded.filter((p) => editor.includes(p))).toEqual([]);
  });

  it("keeps React out of the spec, the recommender and the kind table", () => {
    for (const entry of ["dashboard-spec.ts", "recommend.ts", "tile-kinds.ts"]) {
      const loaded = [...closure(entry)];
      expect(loaded.filter((p) => p === "react" || p.startsWith("@ark-ui/") || p.endsWith(".tsx"))).toEqual([]);
    }
  });

  it("is not blind: it sees the editor once the import is static", () => {
    expect(local(closure("tile-editor.tsx"))).toContain("charts/tile-fields.tsx");
    expect([...closure("tile-views.tsx")]).toContain("react");
  });
});
