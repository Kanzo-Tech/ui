import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGesture } from "./gesture";

function mount() {
  const setTool = vi.fn();
  const commit = vi.fn();
  renderHook(() => useGesture({ getFiltered: () => null, getGraph: () => null, getSelection: () => null, commit, setTool, tool: "lasso" }));
  return { commit, setTool };
}

describe("useGesture's Escape", () => {
  it("drops the tool on an Escape pressed over the page", () => {
    const { setTool } = mount();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(setTool).toHaveBeenCalledWith(null);
  });

  it("leaves an Escape pressed in a field to the field, as every other key here", () => {
    const { commit, setTool } = mount();
    const field = document.body.appendChild(document.createElement("input"));
    fireEvent.keyDown(field, { key: "Escape" });
    field.remove();
    expect(setTool).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("only observes the key, so a dismissable layer under it still gets it", () => {
    mount();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
