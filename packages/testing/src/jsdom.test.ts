import { describe, expect, it, vi } from "vitest";

class Present {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", Present);
await import("./jsdom");

describe("the jsdom setup", () => {
  it("fills what jsdom lacks with something a component can call", () => {
    expect(CSS.escape("a.b:c")).toBe("a\\.b\\:c");
    expect(document.querySelector(`#${CSS.escape("a.b")}`)).toBeNull();
    const observer = new IntersectionObserver(() => {});
    observer.observe(document.body);
    expect(observer.takeRecords()).toEqual([]);
    expect([...document.createRange().getClientRects()]).toEqual([]);
  });

  it("leaves an implementation that is already there in place", () => {
    expect(globalThis.ResizeObserver).toBe(Present);
  });
});
