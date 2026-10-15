import { describe, expect, it } from "vitest";
import { asyncDispose, dispose } from "./index.js";
import { resolveSymbol } from "./dispose.js";

describe("dispose symbols", () => {
  it("are the runtime's own where it has them", () => {
    const native = Symbol("native");
    expect(resolveSymbol("dispose", { dispose: native })).toBe(native);
    expect(resolveSymbol("asyncDispose", { asyncDispose: native })).toBe(native);
    expect(typeof dispose).toBe("symbol");
    expect(typeof asyncDispose).toBe("symbol");
  });

  it("fall back to the registered symbol, and write nothing to a global", () => {
    const before = Object.getOwnPropertyNames(Symbol).sort();
    const fallback = resolveSymbol("dispose", {});
    expect(fallback).toBe(Symbol.for("Symbol.dispose"));
    expect(resolveSymbol("asyncDispose", {})).toBe(Symbol.for("Symbol.asyncDispose"));
    expect(Object.getOwnPropertyNames(Symbol).sort()).toEqual(before);
    expect(Object.keys(globalThis)).not.toContain("dispose");
  });

  it("key a handle that a caller disposes through the exported symbol", async () => {
    let released = 0;
    const handle = { async [asyncDispose]() { released += 1; }, [dispose]() { released += 10; } };
    await handle[asyncDispose]();
    handle[dispose]();
    expect(released).toBe(11);
  });
});
