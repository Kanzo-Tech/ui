import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { label, SHIPPED } from "./guard-corpus";

/**
 * No optional peer is reached from a package's root entry — the first of CLAUDE.md's one-way doors.
 *
 * `index.test.ts` holds that door by names: `CodeEditor`, `ChartRoot`, `DataTable` asserted absent
 * from `@kanzo-tech/ui`. A name is only the part of a peer somebody re-exported. A peer can arrive
 * with no name at all — a hook that calls TanStack Query's `useQuery` inside a component the root
 * exports — and `import { Button }` then throws for every host that did not install it, while every
 * name assertion stays green. This walks the import graph instead: from each shipped package's root
 * module through every relative import, every bare specifier it reaches, against the optional peers
 * that package's manifest declares.
 *
 * ## What this cannot prove
 *
 * - **It reads source, not `dist/`.** A bundler that inlined a module across entries would not be
 *   seen; the builds externalise every peer, so nothing is inlined today.
 * - **It follows static `import` and `export … from` only.** A dynamic `import()` is a lazy door and
 *   is deliberately not followed — that is how an optional module is meant to be reached.
 * - **A `type`-only import is skipped**, because it is erased; an `import { type X }` mixed with a value
 *   import is followed as a value import.
 */

const STATIC = /^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;

function moduleAt(base: string): string | undefined {
  const stem = base.replace(/\.js$/, "");
  return [`${stem}.ts`, `${stem}.tsx`, join(stem, "index.ts"), join(stem, "index.tsx")].find(existsSync);
}

/** Every bare specifier the module graph from `entry` reaches, by the first module that reaches it. */
function reached(entry: string): Map<string, string> {
  const seen = new Set<string>();
  const bare = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, typeOnly, spec] of readFileSync(file, "utf8").matchAll(STATIC)) {
      if (typeOnly || !spec) continue;
      if (spec.startsWith(".")) {
        const next = moduleAt(resolve(dirname(file), spec));
        if (next) queue.push(next);
      } else if (!bare.has(spec)) bare.set(spec, label(file));
    }
  }
  return bare;
}

const packageOf = (spec: string) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

const ROOTS = SHIPPED.flatMap(({ name, src }) => {
  const manifest = JSON.parse(readFileSync(join(dirname(src), "package.json"), "utf8")) as {
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };
  const optional = Object.entries(manifest.peerDependenciesMeta ?? {}).flatMap(([peer, meta]) => (meta.optional ? [peer] : []));
  const entry = moduleAt(join(src, "index"));
  return entry && optional.length > 0 ? [{ name, entry, optional }] : [];
});

describe("optional peers", () => {
  it("finds a root entry with optional peers in the packages that declare them", () => {
    expect(ROOTS.map((r) => r.name)).toEqual(expect.arrayContaining(["ui", "ai"]));
  });

  it("are reached from no package's root entry", () => {
    const leaks = ROOTS.flatMap(({ name, entry, optional }) =>
      [...reached(entry)].filter(([spec]) => optional.includes(packageOf(spec))).map(([spec, by]) => `${name}: ${spec}, by ${by}`),
    );
    expect(leaks).toEqual([]);
  });
});
