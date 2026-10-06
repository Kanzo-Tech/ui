import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { matchesHotkey, useHotkey } from "./use-hotkey.js";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

function Listens({ hotkey, onPress }: { hotkey?: string; onPress: () => void }) {
  useHotkey(hotkey, onPress);
  return <input aria-label="field" />;
}

describe("one grammar for a key", () => {
  it("reads mod as ⌘ or Ctrl, and a bare key only with no modifier held", () => {
    expect(matchesHotkey("mod+k", key({ key: "k", metaKey: true }))).toBe(true);
    expect(matchesHotkey("mod+k", key({ key: "K", ctrlKey: true }))).toBe(true);
    expect(matchesHotkey("mod+k", key({ key: "k" }))).toBe(false);
    expect(matchesHotkey("p", key({ key: "p" }))).toBe(true);
    expect(matchesHotkey("p", key({ key: "p", metaKey: true }))).toBe(false);
    expect(matchesHotkey("p", key({ key: "p", altKey: true }))).toBe(false);
  });

  it("leaves a key pressed while typing in a field to the field, and registers nothing unasked", () => {
    const onPress = vi.fn();
    const { getByLabelText, rerender } = render(<Listens hotkey="mod+k" onPress={onPress} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(getByLabelText("field"), { key: "k", metaKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<Listens onPress={onPress} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
