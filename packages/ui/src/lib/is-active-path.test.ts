import { describe, expect, it } from "vitest";
import { isActivePath } from "./is-active-path.js";

describe("isActivePath", () => {
  it("matches the route itself", () => {
    expect(isActivePath("/settings", "/settings")).toBe(true);
  });

  it("matches a descendant", () => {
    expect(isActivePath("/settings/cloud", "/settings")).toBe(true);
  });

  it("stops at the segment boundary", () => {
    // The reason this is a function: `startsWith("/settings")` says yes here, and it is wrong.
    expect(isActivePath("/settings-archive", "/settings")).toBe(false);
  });

  it("is false when either side is missing", () => {
    expect(isActivePath(undefined, "/settings")).toBe(false);
    expect(isActivePath("/settings", undefined)).toBe(false);
  });
});
