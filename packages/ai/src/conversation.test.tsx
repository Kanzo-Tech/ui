import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollButton,
} from "./conversation.js";

// jsdom reports zero for every layout measurement and never fires a ResizeObserver, so both halves
// of the pin have to be driven by hand: the box is defined onto the element, and the observer is
// replaced by one the test can trigger.
const callbacks = new Set<() => void>();
const realObserver = globalThis.ResizeObserver;

class FakeResizeObserver {
  constructor(private readonly callback: () => void) {
    callbacks.add(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    callbacks.delete(this.callback);
  }
}

beforeEach(() => {
  callbacks.clear();
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realObserver;
});

const box = (el: HTMLElement, values: { scrollHeight: number; clientHeight: number; scrollTop: number }) => {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: values.scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: values.clientHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    value: values.scrollTop,
    writable: true,
  });
};

const grow = (el: HTMLElement, scrollHeight: number) => {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  act(() => {
    for (const callback of callbacks) callback();
  });
};

const Harness = () => (
  <Conversation>
    <ConversationContent>
      <p>a message</p>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
);

const scrollButton = () => screen.queryByRole("button", { name: "Scroll to the latest message" });

describe("Conversation", () => {
  it("follows the tail while the reader is at it", () => {
    render(<Harness />);
    const viewport = screen.getByRole("log");

    box(viewport, { scrollHeight: 1000, clientHeight: 300, scrollTop: 700 });
    fireEvent.scroll(viewport);
    expect(scrollButton()).toBeNull();

    grow(viewport, 1400);
    expect(viewport.scrollTop).toBe(1400);
  });

  // The defect this component exists for: the naive effect follows the tail unconditionally, so a
  // reader who scrolled up is dragged back down by every token.
  it("releases the pin the moment the reader scrolls up, and stays released while it grows", () => {
    render(<Harness />);
    const viewport = screen.getByRole("log");

    box(viewport, { scrollHeight: 1000, clientHeight: 300, scrollTop: 100 });
    fireEvent.scroll(viewport);
    expect(scrollButton()).not.toBeNull();

    grow(viewport, 1400);
    expect(viewport.scrollTop).toBe(100);
  });

  it("re-pins on the button, which then goes away and the tail is followed again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const viewport = screen.getByRole("log");

    box(viewport, { scrollHeight: 1000, clientHeight: 300, scrollTop: 100 });
    fireEvent.scroll(viewport);

    const button = scrollButton();
    expect(button).not.toBeNull();
    await user.click(button as HTMLElement);

    expect(viewport.scrollTop).toBe(1000);
    expect(scrollButton()).toBeNull();

    grow(viewport, 1800);
    expect(viewport.scrollTop).toBe(1800);
  });

  it("names its parts, and the empty state is a part like any other", () => {
    render(
      <Conversation>
        <ConversationContent>
          <ConversationEmpty>Ask about your data</ConversationEmpty>
        </ConversationContent>
      </Conversation>,
    );

    const root = document.querySelector("[data-slot=conversation]");
    expect(root?.getAttribute("data-slot")).toBe("conversation");
    expect(screen.getByRole("log").getAttribute("data-slot")).toBe("conversation-content");
    expect(
      document.querySelector("[data-slot=conversation-empty]")?.textContent,
    ).toBe("Ask about your data");
  });
});
