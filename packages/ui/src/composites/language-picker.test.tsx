import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, FieldLabel } from "../simples/field.js";
import { LanguagePicker } from "./language-picker.js";

// `userEvent.type` drops characters once a `Combobox` has re-rendered under it in jsdom — plain Ark
// with no code of ours in it loses the fourth character of "gammaxyzw" — so the text is set whole.
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });

const input = () => screen.getByRole("combobox") as HTMLInputElement;

describe("LanguagePicker", () => {
  it("shows the selected language by its own name and its tag", () => {
    render(<LanguagePicker aria-label="Language" onValueChange={() => {}} value="es" />);

    expect(input().value).toBe("Español · es");
  });

  it("finds a language by its tag or by its name in its own language", async () => {
    const user = userEvent.setup();
    render(<LanguagePicker aria-label="Language" onValueChange={() => {}} value="" />);

    await user.click(input());
    type("deutsch");
    expect(screen.getByRole("option", { name: /Deutsch · de/ })).toBeTruthy();

    type("fr");
    expect(screen.getByRole("option", { name: /Français · fr/ })).toBeTruthy();
  });

  it("reports the tag a pick lands on", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<LanguagePicker aria-label="Language" onValueChange={onValueChange} value="" />);

    await user.click(input());
    await user.click(await screen.findByRole("option", { name: /Català · ca/ }));

    expect(onValueChange).toHaveBeenLastCalledWith("ca");
  });

  it("lets a well-formed tag nobody listed stand, spelled canonically, and refuses a malformed one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<LanguagePicker aria-label="Language" onValueChange={onValueChange} value="" />);

    await user.click(input());
    type("es-mx");
    // Not per keystroke: "es" is a tag on the way to "es-MX", and reporting it would make the
    // control swap the text for the name of the language the user is still spelling.
    expect(onValueChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("es-MX");

    onValueChange.mockClear();
    await user.click(input());
    type("e_");
    await user.tab();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("offers exactly the languages it is given, and takes no other tag", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LanguagePicker
        aria-label="Language"
        languages={["es", "ca"]}
        onValueChange={onValueChange}
        value=""
      />,
    );

    await user.click(input());
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("Español"),
      expect.stringContaining("Català"),
    ]);

    await user.click(input());
    type("fr");
    await user.tab();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("says nothing matched in the host's words", async () => {
    const user = userEvent.setup();
    render(
      <LanguagePicker
        aria-label="Idioma"
        onValueChange={() => {}}
        translations={{ noMatches: "Sin resultados" }}
        value=""
      />,
    );

    await user.click(input());
    type("qqqq");
    expect(await screen.findByText("Sin resultados")).toBeTruthy();
  });

  it("inherits disabled from an ancestor Field, and is the field's control", () => {
    render(
      <Field disabled>
        <FieldLabel>Language</FieldLabel>
        <LanguagePicker onValueChange={() => {}} value="" />
      </Field>,
    );

    expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy();
    expect(input().disabled).toBe(true);
  });

  it("draws only its input when inline, and gives it an id of its own inside a Field", () => {
    render(
      <Field>
        <FieldLabel>Title</FieldLabel>
        <input data-testid="text" id="title" />
        <LanguagePicker aria-label="Language" inline onValueChange={() => {}} value="" />
      </Field>,
    );

    expect(document.querySelector("[data-slot=input-group]")).toBeNull();
    expect(input().id).not.toBe("title");
  });
});
