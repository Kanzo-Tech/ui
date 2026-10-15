import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as kernel from "./index.js";
import type { Queryable, Table, Vector } from "./index.js";

const SRC = dirname(fileURLToPath(import.meta.url));
const PKG = join(SRC, "..");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("the kernel is layer 0", () => {
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

  it("exports the five pieces and no others", () => {
    expect(Object.keys(kernel).sort()).toEqual(["Problem", "asyncDispose", "dispose", "isCode", "isProblem", "mark", "until", "within"]);
  });
});

describe("Queryable", () => {
  it("is satisfied by an Arrow-shaped table without a conversion", async () => {
    const vector: Vector = { length: 2, get: (i) => [1, 2][i], toArray: () => [1, 2] };
    const table: Table = { numRows: 2, schema: { fields: [{ name: "n" }] }, getChild: (name) => (name === "n" ? vector : null) };
    const engine: Queryable = { query: async () => table };
    const answer = await engine.query("select 1", { signal: new AbortController().signal });
    expect(answer.getChild("n")?.get(1)).toBe(2);
    expect(answer.getChild("missing")).toBeNull();
  });
});
