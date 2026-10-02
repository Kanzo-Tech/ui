import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Editable,
  EditableArea,
  EditableControl,
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  type EditableProps,
  type EditablePreviewProps,
} from "./editable.js";
import { Field, FieldLabel } from "./field.js";
import { Input } from "./input.js";
import { Textarea } from "./textarea.js";

const preview = () => document.querySelector<HTMLElement>("[data-slot=editable-preview]")!;

function Name({
  preview: previewProps,
  ...props
}: Partial<EditableProps> & { preview?: EditablePreviewProps }) {
  return (
    <Field>
      <FieldLabel>Name</FieldLabel>
      <Editable defaultValue="A wyrm under the granary" {...props}>
        <EditableArea>
          <EditableInput asChild>
            <Input />
          </EditableInput>
          <EditablePreview {...previewProps} />
        </EditableArea>
      </Editable>
    </Field>
  );
}

/** jsdom lays nothing out, so the overflow the preview measures is stubbed per test. */
function stubWidths(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(client);
}

afterEach(() => vi.restoreAllMocks());

describe("EditablePreview", () => {
  it("renders the value inside a text span, at md unless sized", () => {
    const { rerender } = render(<Name />);
    expect(preview().dataset.size).toBe("md");
    expect(preview().querySelector("[data-slot=editable-preview-text]")?.textContent).toBe(
      "A wyrm under the granary",
    );

    rerender(<Name preview={{ size: "sm" }} />);
    expect(preview().dataset.size).toBe("sm");
  });

  it("is a single ellipsised line over an input, and wraps over a textarea", () => {
    const { unmount } = render(<Name />);
    expect(preview().className).toContain("whitespace-nowrap");
    expect(preview().querySelector("[data-slot=editable-preview-text]")?.className).toContain(
      "text-ellipsis",
    );
    unmount();

    render(
      <Editable defaultValue="Two lines">
        <EditableArea>
          <EditableInput asChild>
            <Textarea />
          </EditableInput>
          <EditablePreview />
        </EditableArea>
      </Editable>,
    );
    expect(preview().className).toContain(
      "in-[[data-slot=editable-area]:has(textarea)]:whitespace-pre-wrap",
    );
  });

  it("carries the full value as its title only once it is cut off", () => {
    stubWidths(100, 100);
    const { unmount } = render(<Name />);
    expect(preview().title).toBe("");
    unmount();

    stubWidths(300, 100);
    render(<Name />);
    expect(preview().title).toBe("A wyrm under the granary");
  });

  it("does not title a placeholder, and a caller's title wins", () => {
    stubWidths(300, 100);
    const { unmount } = render(<Name defaultValue="" placeholder="Unnamed job" />);
    expect(preview().title).toBe("");
    unmount();

    render(<Name preview={{ title: "Mine" }} />);
    expect(preview().title).toBe("Mine");
  });
});

describe("Editable", () => {
  it("labels its input through the surrounding Field", async () => {
    render(<Name defaultEdit />);
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "A wyrm under the granary");
  });

  it("starts on a double click when asked to, and commits on Enter", async () => {
    const user = userEvent.setup();
    const onValueCommit = vi.fn();
    render(<Name activationMode="dblclick" onValueCommit={onValueCommit} />);

    await user.click(preview());
    expect(preview().hidden).toBe(false);

    await user.dblClick(preview());
    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "The miller's debt{Enter}");

    expect(onValueCommit).toHaveBeenCalledWith(
      expect.objectContaining({ value: "The miller's debt" }),
    );
    expect(preview().textContent).toBe("The miller's debt");
  });

  it("reverts on Escape", async () => {
    const user = userEvent.setup();
    render(<Name activationMode="click" />);

    await user.click(preview());
    await user.type(screen.getByLabelText("Name"), " and more{Escape}");

    expect(preview().textContent).toBe("A wyrm under the granary");
  });

  it("with submitMode enter, blurring away reverts instead of committing", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Name activationMode="click" submitMode="enter" />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.click(preview());
    await user.type(screen.getByLabelText("Name"), "!");
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(preview().textContent).toBe("A wyrm under the granary");
  });

  it("mirrors orientation and shows the edit trigger only at rest", async () => {
    const user = userEvent.setup();
    render(
      <Editable activationMode="none" defaultValue="x" orientation="vertical">
        <EditableArea>
          <EditableInput />
          <EditablePreview />
        </EditableArea>
        <EditableControl>
          <EditableEditTrigger>Edit</EditableEditTrigger>
        </EditableControl>
      </Editable>,
    );

    expect(document.querySelector("[data-slot=editable]")?.getAttribute("data-orientation")).toBe(
      "vertical",
    );
    await user.click(screen.getByText("Edit"));
    expect(preview().hidden).toBe(true);
  });
});
