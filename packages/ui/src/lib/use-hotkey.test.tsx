import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type HotkeyOptions, matchesHotkey, useHotkey } from "./use-hotkey.js";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

function Listens({
  hotkey,
  onPress,
  options,
}: {
  hotkey?: string | string[];
  onPress: (hotkey: string) => void;
  options?: HotkeyOptions;
}) {
  useHotkey(hotkey, onPress, options);
  return (
    <>
      <input aria-label="field" />
      <input aria-label="choice" hidden type="radio" />
      <input aria-label="tick" hidden type="checkbox" />
      <textarea aria-label="notes" />
    </>
  );
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

  it("fires a bare key while a hidden radio or checkbox holds focus, and not while typing in a text field", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<Listens hotkey="p" onPress={onPress} />);
    fireEvent.keyDown(getByLabelText("choice"), { key: "p" });
    fireEvent.keyDown(getByLabelText("tick"), { key: "p" });
    expect(onPress).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(getByLabelText("field"), { key: "p" });
    fireEvent.keyDown(getByLabelText("notes"), { key: "p" });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("takes a list, and hands the handler the key that matched", () => {
    const onPress = vi.fn();
    render(<Listens hotkey={["1", "2"]} onPress={onPress} />);
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "3" });
    expect(onPress.mock.calls).toEqual([["2"]]);
  });

  it("claims the key unless told only to observe, and hears it ahead of a part that stops it in capture", () => {
    const onPress = vi.fn();
    const { getByLabelText, rerender } = render(<Listens hotkey="Escape" onPress={onPress} />);
    expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(false);

    rerender(<Listens hotkey="Escape" onPress={onPress} options={{ capture: true, preventDefault: false }} />);
    const stop = (event: Event) => event.stopPropagation();
    document.addEventListener("keydown", stop, true);
    try {
      expect(fireEvent.keyDown(getByLabelText("choice"), { key: "Escape" })).toBe(true);
    } finally {
      document.removeEventListener("keydown", stop, true);
    }
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
