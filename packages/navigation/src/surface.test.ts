// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

const SRC = dirname(fileURLToPath(import.meta.url));

const shipped = readdirSync(SRC)
  .filter((file) => /\.tsx?$/.test(file) && !/\.(test|fixture)\.tsx?$/.test(file))
  .map((file) => file.replace(/\.tsx?$/, ""));

const source = (module: string) => {
  const file = shipped.includes(module)
    ? readdirSync(SRC).find((f) => f.replace(/\.tsx?$/, "") === module)
    : undefined;
  if (!file) throw new Error(`no module ${module}`);
  return readFileSync(resolve(SRC, file), "utf8");
};

/** Everything a module reaches by relative import, transitively — all three spellings. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const module = pending.pop();
    if (module === undefined || seen.has(module)) continue;
    seen.add(module);
    for (const match of source(module).matchAll(/(?:\bfrom|\bimport)\s*\(?\s*"(\.[^"]+)"/g)) {
      pending.push(relative(SRC, resolve(SRC, match[1] as string)));
    }
  }
  return seen;
}

describe("@kanzo-tech/navigation's surface", () => {
  it("is one hook at the root", async () => {
    expect(Object.keys(await import("./index")).sort()).toEqual(["useBlocker"]);
  });

  it("is Link and useRouter on /next", async () => {
    expect(Object.keys(await import("./next")).sort()).toEqual(["Link", "useRouter"]);
  });

  /**
   * `next` is an optional peer, and the one-way door on optional peers applies here exactly as it
   * does to `@kanzo-tech/ui`: a static import of it anywhere the root reaches breaks the root for a
   * host that is not Next.
   */
  it("keeps next out of everything the root reaches", () => {
    for (const module of reachable("index")) {
      expect(source(module), module).not.toMatch(/from\s+"next[/"]/);
    }
  });

  /**
   * The techniques `next-navigation-guard` is built on, and the reason this package exists instead
   * of adopting it. Each is either a patch on something the router owns or a reach into its
   * internals, and each was ruled out by name in the design: `/docs/design/navigation`.
   */
  it("patches no history, reads no router internals and captures no clicks", () => {
    for (const module of shipped) {
      const code = source(module).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, module).not.toMatch(/pushState|replaceState/);
      expect(code, module).not.toMatch(/AppRouterContext|next\/dist\//);
      expect(code, module).not.toMatch(/document\.addEventListener/);
      expect(code, module).not.toMatch(/popstate/);
    }
  });

  it("offers no Block component and no useBeforeUnload", async () => {
    const surface = { ...(await import("./index")), ...(await import("./next")) };
    expect(surface).not.toHaveProperty("Block");
    expect(surface).not.toHaveProperty("useBeforeUnload");
  });
});
