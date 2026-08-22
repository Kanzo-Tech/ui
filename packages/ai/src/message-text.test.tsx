import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageText } from "./message-text.js";

const spans = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("[data-slot=message-text] > span"),
];
/** The word spans — everything but the caret, which is always last. */
const words = (root: HTMLElement) =>
  spans(root).filter((span) => span.dataset.slot !== "message-caret");
const delay = (span: HTMLElement) => Number.parseFloat(span.style.animationDelay) || 0;

describe("MessageText", () => {
  /**
   * **The trap this component exists to avoid.** Keyed by the word, the last word remounts on every
   * frame while its own characters are still arriving: its arrival restarts each time and it
   * flashes instead of settling. Keyed by absolute character offset it does not, and the way to
   * assert that is node identity across a re-render — a remounted span is a different element.
   */
  it("keeps a word's element across a re-render, so its arrival is not restarted", () => {
    const { container, rerender } = render(<MessageText streaming>Four of</MessageText>);
    const [first, second] = words(container);

    rerender(<MessageText streaming>Four of them.</MessageText>);

    const after = words(container);
    expect(after[0]).toBe(first);
    expect(after[1]).toBe(second);
    expect(after[2]?.textContent).toBe("them.");
  });

  /**
   * A stream delivers twenty words at once and then nothing for 200ms. Without a per-word delay
   * the twenty fade in together, which is a flash — the thing the animation exists to avoid.
   * Streamdown staggers for the same reason.
   */
  it("cascades a batch instead of fading it in at once", () => {
    const { container, rerender } = render(<MessageText streaming>{"one "}</MessageText>);
    rerender(<MessageText streaming>{"one two three four"}</MessageText>);

    const [, ...arriving] = words(container);
    expect(arriving).toHaveLength(3);
    expect(arriving.map(delay)).toEqual([0, 18, 36]);
    // The word that was already on screen is not re-scheduled.
    expect(words(container)[0]?.style.animationDelay).toBe("");
  });

  /**
   * **The budget, and it is why a naive stagger is wrong.** At the full 18ms step this batch would
   * schedule its last word 4.4 seconds after the text arrived, so an unbounded queue of invisible
   * words builds up behind a stream that has already finished.
   *
   * The compression bottoms out at the 4ms floor rather than at the budget, and **that overshoot is
   * deliberate and is Streamdown's** — its own comment says the batch "may overshoot budgetEnd
   * slightly when minStep forces it", and the alternative is a step of zero, which is the flash the
   * stagger exists to prevent. So the invariant is not "inside the budget"; it is *compressed
   * toward the budget, never below the floor, and ordered*.
   */
  it("compresses the cascade so a fast stream does not queue behind it", () => {
    const count = 250;
    const many = Array.from({ length: count }, (_, i) => `w${i}`).join(" ");
    const { container, rerender } = render(<MessageText streaming>{"w "}</MessageText>);
    rerender(<MessageText streaming>{many}</MessageText>);

    const arriving = words(container).slice(1);
    const last = delay(arriving.at(-1) as HTMLElement);
    const step = last / (arriving.length - 1);

    expect(step).toBeCloseTo(4, 5); // the floor, not the 18ms ideal
    expect(last).toBeLessThan(count * 18); // and a fifth of what the ideal would have cost
  });

  /** A message that mounts complete did not arrive, so a transcript from history does not replay. */
  it("does not animate an answer that was already there when it mounted", () => {
    const { container } = render(<MessageText>Four of them.</MessageText>);
    for (const word of words(container)) {
      expect(word.className).toBe("");
    }
  });

  /**
   * The tree is the same shape streaming or not — same word spans, same caret element — so nothing
   * remounts at the moment the answer finishes and the arrival does not run a second time.
   */
  it("does not change shape when the stream ends", () => {
    const { container, rerender } = render(<MessageText streaming>Four of them.</MessageText>);
    const before = spans(container);

    rerender(<MessageText>Four of them.</MessageText>);

    expect(spans(container)).toEqual(before);
    expect(container.querySelector("[data-slot=message-caret]")).not.toBeNull();
  });

  /**
   * Split into spans for the animation and reassembled by the DOM: `textContent` is the answer
   * back, byte for byte. A copy, a selection and a screen reader all read this and not the spans.
   */
  it("carries the whole answer as text, whitespace included", () => {
    const { container } = render(
      <MessageText>{"Four of them,\n and one was filed twice."}</MessageText>,
    );
    const root = container.querySelector("[data-slot=message-text]");
    expect(root?.textContent).toBe("Four of them,\n and one was filed twice.");
  });
});
