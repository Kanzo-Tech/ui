import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { InputGroupButton, Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "@kanzo-tech/ui";
import {
  PromptInput,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "./prompt-input.js";
import type { ChatStatus } from "@kanzo-tech/llm";

const Composer = (props: { onSubmit: (e: React.FormEvent) => void; status?: ChatStatus }) => (
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

  it("names the field by its placeholder, unless the caller names it", () => {
    const { unmount } = render(<Composer onSubmit={submitHandler()} />);
    expect(screen.getByRole("textbox", { name: "Ask about your data…" })).toBeTruthy();
    unmount();
    render(
      <PromptInput>
        <PromptInputTextarea aria-label="Question" placeholder="Ask about your data…" />
      </PromptInput>,
    );
    expect(screen.getByRole("textbox", { name: "Question" })).toBeTruthy();
  });

  it("names the button by what pressing it would do", () => {
    const { rerender } = render(<Composer onSubmit={submitHandler()} />);
    expect(screen.getByRole("button", { name: "Send" }).getAttribute("type")).toBe("submit");

    rerender(<Composer onSubmit={submitHandler()} status="streaming" />);
    expect(screen.getByRole("button", { name: "Stop" }).getAttribute("data-status")).toBe(
      "streaming",
    );

    rerender(<Composer onSubmit={submitHandler()} status="submitted" />);
    expect(screen.getByRole("button", { name: "Stop" })).not.toBeNull();

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

  // Keasy's composer: a pill per connection above the field, each opening a checkable list of the
  // connection's files. The pill is the host's and the menu is ui's; what the header owes is the
  // place — a direct child of the group, so `has-[>[data-align=block-start]]` lays the box out as a
  // column — and a press that stays the pill's.
  it("carries the host's pills above the field, each opening what it holds", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <PromptInput onSubmit={submitHandler()}>
        <PromptInputTextarea placeholder="Ask about your data…" />
        <PromptInputHeader>
          <Menu>
            <MenuTrigger asChild>
              <InputGroupButton pill variant="outline">
                Warehouse · 2 files
              </InputGroupButton>
            </MenuTrigger>
            <MenuContent>
              <MenuCheckboxItem checked onCheckedChange={onCheckedChange} value="orders.parquet">
                orders.parquet
              </MenuCheckboxItem>
            </MenuContent>
          </Menu>
        </PromptInputHeader>
      </PromptInput>,
    );

    const field = screen.getByPlaceholderText("Ask about your data…");
    const header = document.querySelector("[data-slot=prompt-input-header]") as HTMLElement;
    expect(header.parentElement).toBe(field.parentElement);
    expect(header.getAttribute("data-align")).toBe("block-start");

    await user.click(screen.getByRole("button", { name: "Warehouse · 2 files" }));
    expect(document.activeElement).not.toBe(field);
    const file = await screen.findByRole("menuitemcheckbox", { name: "orders.parquet" });
    expect(file.getAttribute("aria-checked")).toBe("true");
    await user.click(file);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("puts the caret in the field on a press of the header's band, outside any pill", async () => {
    const user = userEvent.setup();
    render(
      <PromptInput>
        <PromptInputHeader>Sources</PromptInputHeader>
        <PromptInputTextarea placeholder="Ask about your data…" />
      </PromptInput>,
    );

    await user.click(document.querySelector("[data-slot=prompt-input-header]") as HTMLElement);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Ask about your data…"));
  });
});
