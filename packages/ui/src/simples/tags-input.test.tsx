import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, FieldLabel } from "./field.js";
import { TagsInput, TagsInputControl, TagsInputHiddenInput, TagsInputInput } from "./tags-input.js";

describe("TagsInput in a Field", () => {
  it("is named by the field's label on the input a person types in, not on the hidden one", () => {
    render(
      <Field>
        <FieldLabel>Keywords</FieldLabel>
        <TagsInput>
          <TagsInputControl>
            <TagsInputInput />
          </TagsInputControl>
          <TagsInputHiddenInput />
        </TagsInput>
      </Field>,
    );

    const typed = screen.getByRole("textbox", { name: "Keywords" });
    expect(typed.getAttribute("data-part")).toBe("input");
    const hidden = document.querySelector<HTMLInputElement>("input[type=hidden], input[hidden]");
    expect(hidden?.id).not.toBe(typed.id);
  });

  it("keeps ids the caller passes", () => {
    render(
      <Field>
        <FieldLabel>Keywords</FieldLabel>
        <TagsInput ids={{ input: "mine" }}>
          <TagsInputControl>
            <TagsInputInput />
          </TagsInputControl>
        </TagsInput>
      </Field>,
    );

    expect(document.getElementById("mine")?.getAttribute("data-part")).toBe("input");
  });
});
