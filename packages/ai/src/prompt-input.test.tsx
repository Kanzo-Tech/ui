import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "./prompt-input.js";
import type { AiStatus } from "./use-ai.js";

const Composer = (props: { onSubmit: (e: React.FormEvent) => void; status?: AiStatus }) => (
  <PromptInput onSubmit={props.onSubmit}>
    <PromptInputTextarea placeholder="Ask about your data…" />
    <PromptInputToolbar>
      <PromptInputSubmit status={props.status} />
    </PromptInputToolbar>
  </PromptInput>
);

const submitHandler = () => vi.fn((event: React.FormEvent) => event.preventDefault());

describe("PromptInput", () => {
  it("sends on Enter and keeps Shift+Enter for the newline", async () => {
    const user = userEvent.setup();
    const onSubmit = submitHandler();
    render(<Composer onSubmit={onSubmit} />);

    const field = screen.getByPlaceholderText("Ask about your data…");
    await user.type(field, "how many contracts{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.type(field, "{Shift>}{Enter}{/Shift}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("the button submits the same form", async () => {
    const user = userEvent.setup();
    const onSubmit = submitHandler();
    render(<Composer onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("names the button by what pressing it would do", () => {
    const { rerender } = render(<Composer onSubmit={submitHandler()} />);
    expect(screen.getByRole("button", { name: "Send" }).getAttribute("type")).toBe("submit");

    rerender(<Composer onSubmit={submitHandler()} status="loading" />);
    expect(screen.getByRole("button", { name: "Stop" }).getAttribute("data-status")).toBe(
      "loading",
    );

    rerender(<Composer onSubmit={submitHandler()} status="error" />);
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeNull();
  });

  it("does not rename a button that already says what it does", () => {
    render(
      <PromptInput onSubmit={submitHandler()}>
        <PromptInputSubmit>Ask</PromptInputSubmit>
      </PromptInput>,
    );

    const button = screen.getByRole("button", { name: "Ask" });
    expect(button.getAttribute("aria-label")).toBeNull();
  });

  // `InputGroup`'s recipe selects its own DIRECT children — `has-[>textarea]` for the tall box,
  // `has-[>[data-align=block-end]]` for the column layout — so an element between the group and
  // either part silently unsets half of it. That is what `asChild` on the form is protecting.
  it("is the input group itself, with the field and the toolbar as direct children", () => {
    render(<Composer onSubmit={submitHandler()} />);

    const field = screen.getByPlaceholderText("Ask about your data…");
    const form = field.parentElement as HTMLElement;
    expect(form.tagName).toBe("FORM");
    expect(form.getAttribute("data-slot")).toBe("prompt-input");

    const toolbar = document.querySelector("[data-slot=prompt-input-toolbar]");
    expect(toolbar?.parentElement).toBe(form);
    expect(toolbar?.getAttribute("data-align")).toBe("block-end");
  });
});
