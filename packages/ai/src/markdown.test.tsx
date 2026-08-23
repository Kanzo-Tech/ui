import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageMarkdown } from "./markdown.js";

const root = (container: HTMLElement, slot = "message-markdown") =>
  container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);

describe("MessageMarkdown", () => {
  /**
   * The wrapper renders no element of its own — `data-slot` is handed to `Streamdown` and lands
   * only because it spreads what it does not consume. That is a fact about a dependency rather
   * than about this file, so it is asserted rather than assumed: the part is the one thing a
   * consumer selects on, and `MessageText` next to it answers to `[data-slot=message-text]`.
   */
  it("names itself, and `slot` renames it", () => {
    const { container, rerender } = render(<MessageMarkdown>A line.</MessageMarkdown>);
    expect(root(container)).not.toBeNull();

    rerender(<MessageMarkdown slot="answer">A line.</MessageMarkdown>);
    expect(root(container)).toBeNull();
    expect(root(container, "answer")).not.toBeNull();
  });

  it("says it is streaming only while it is", () => {
    const { container, rerender } = render(<MessageMarkdown streaming>A line.</MessageMarkdown>);
    expect(root(container)?.dataset.streaming).toBe("true");

    rerender(<MessageMarkdown>A line.</MessageMarkdown>);
    expect(root(container)?.dataset.streaming).toBeUndefined();
  });

  /**
   * The whole reason the subpath exists. Mid-stream `**bo` is not bold yet, and a parser that
   * renders it honestly flickers literal asterisks into place as the answer completes.
   */
  it("closes an unterminated emphasis while streaming, and leaves it alone when static", () => {
    const { container, rerender } = render(
      <MessageMarkdown streaming>{"It is **gra"}</MessageMarkdown>,
    );
    // Streamdown emits its own marked-up `span`, not a `strong`, so the assertion is on the text
    // the reader sees rather than on the tag it chose.
    expect(root(container)?.textContent).toBe("It is gra");

    rerender(<MessageMarkdown>{"It is **gra"}</MessageMarkdown>);
    expect(root(container)?.textContent).toBe("It is **gra");
  });
});
