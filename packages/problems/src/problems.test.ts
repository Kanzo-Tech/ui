import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as problems from "./index.js";

const SRC = dirname(fileURLToPath(import.meta.url));
const PKG = join(SRC, "..");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("the package is layer 0", () => {
  it("declares no dependency and no peer", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]) {
      expect(pkg[field], field).toBeUndefined();
    }
    expect(pkg.kanzo.layers).toEqual({ ".": 0 });
  });

  it("imports nothing but its own files, statically or dynamically", () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const text = readFileSync(join(SRC, file), "utf8");
      const specs = [...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of specs) expect(spec, `${file} imports ${spec}`).toMatch(/^\.\//);
      expect(text, `${file} requires`).not.toMatch(/\brequire\s*\(/);
    }
  });

  it("touches no DOM and no window", () => {
    for (const file of sources) {
      expect(readFileSync(join(SRC, file), "utf8"), file).not.toMatch(/\b(window|document|navigator|localStorage)\b/);
    }
  });

  it("does nothing at import: no global gained", async () => {
    const before = Object.getOwnPropertyNames(globalThis).sort();
    vi.resetModules();
    await import("./index.js");
    expect(Object.getOwnPropertyNames(globalThis).sort()).toEqual(before);
  });

  it("exports the failure and the wait, and nothing else", () => {
    expect(Object.keys(problems).sort()).toEqual(["Problem", "isCode", "isProblem", "until", "within"]);
  });
});
