import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Field,
  FieldHelper,
  FieldLabel,
  Input,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemPreview,
  TagsInputItemText,
  Textarea,
} from "@kanzo-tech/ui";
import { Assist, AssistProvider } from "./assist.js";
import type { AssistEvent } from "./engine.js";
import { elements, mockModel, promptOf } from "./testing/model.js";
import { MockLanguageModelV4 } from "ai/test";

const ghostText = () => document.querySelector("[data-slot=assist-ghost] .text-faint")?.textContent ?? "";
const mark = () => screen.getByRole("button", { name: /AI assist|Accept suggestion|Suggest different values|Undo AI suggestion/ });

function Notice(props: { model: ReturnType<typeof mockModel>["model"]; onEvent?: (e: AssistEvent) => void; initial?: string }) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <AssistProvider context="A notice board for a village hall." model={props.model} onEvent={props.onEvent}>
      <Field>
        <FieldLabel>Notice</FieldLabel>
        <Assist onValueChange={setValue} value={value}>
          <Textarea />
        </Assist>
        <FieldHelper>What the party is walking into.</FieldHelper>
      </Field>
      <output data-testid="value">{value}</output>
    </AssistProvider>
  );
}

const value = () => screen.getByTestId("value").textContent;

describe("Assist on a Textarea — a continuation at the caret", () => {
  it("offers ghost text after a pause, and Tab takes it", async () => {
    const { model } = mockModel(() => " at the ford.");
    const onEvent = vi.fn();
    render(<Notice model={model} onEvent={onEvent} />);
    const field = screen.getByRole("textbox", { name: "Notice" });

    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(ghostText()).toBe(" at the ford."), { timeout: 2000 });

    fireEvent.keyDown(field, { key: "Tab" });
    expect(value()).toBe("Three hounds seen at the ford.");
    expect(onEvent.mock.calls.map(([e]) => e.kind)).toEqual(["shown", "accepted"]);
    expect(onEvent.mock.calls[0]?.[0].field).toBe("Notice");
  });

  it("tells the model what the field is: its label, its description and the form", async () => {
    const { model } = mockModel(() => " more");
    render(<Notice model={model} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Three hounds", selectionStart: 12 } });
    await waitFor(() => expect(model.doStreamCalls).toHaveLength(1), { timeout: 2000 });
    const prompt = promptOf(model.doStreamCalls[0]!);
    expect(prompt).toContain("Field: Notice");
    expect(prompt).toContain("What the party is walking into.");
    expect(prompt).toContain("A notice board for a village hall.");
    expect(prompt).toContain("Three hounds<caret/>");
  });

  it("keeps the offer while the reader types what it says, and asks nothing new", async () => {
    const { model } = mockModel(() => " at the ford.");
    render(<Notice model={model} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(ghostText()).toBe(" at the ford."), { timeout: 2000 });

    fireEvent.change(field, { target: { value: "Three hounds seen at", selectionStart: 20 } });
    expect(ghostText()).toBe(" the ford.");
    await new Promise((r) => setTimeout(r, 450));
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("takes one word with Ctrl+→, and lets the rest go with Esc", async () => {
    const { model } = mockModel(() => " at the ford.");
    const onEvent = vi.fn();
    render(<Notice model={model} onEvent={onEvent} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(ghostText()).toBe(" at the ford."), { timeout: 2000 });

    fireEvent.keyDown(field, { key: "ArrowRight", ctrlKey: true });
    expect(value()).toBe("Three hounds seen at");
    await waitFor(() => expect(ghostText()).toBe(" the ford."));

    fireEvent.keyDown(field, { key: "Escape" });
    expect(ghostText()).toBe("");
    expect(onEvent.mock.calls.map(([e]) => e.kind)).toEqual(["shown", "partial", "rejected"]);
  });

  it("asks for an alternative with Alt+], and goes back with Alt+[", async () => {
    const { model } = mockModel((_, i) => (i === 0 ? " at the ford." : " by the mill."));
    render(<Notice model={model} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(ghostText()).toBe(" at the ford."), { timeout: 2000 });

    fireEvent.keyDown(field, { key: "]", altKey: true });
    await waitFor(() => expect(ghostText()).toBe(" by the mill."));
    expect(promptOf(model.doStreamCalls[1]!)).toContain("- at the ford.");

    fireEvent.keyDown(field, { key: "[", altKey: true });
    await waitFor(() => expect(ghostText()).toBe(" at the ford."));
  });

  it("puts the old value back from the ✨ right after a suggestion was taken", async () => {
    const { model } = mockModel(() => " at the ford.");
    render(<Notice model={model} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(ghostText()).not.toBe(""), { timeout: 2000 });
    fireEvent.keyDown(field, { key: "Tab" });

    await userEvent.click(screen.getByRole("button", { name: "Undo AI suggestion" }));
    expect(value()).toBe("Three hounds seen");
  });

  it("marks the field at rest, busy while asking, and lit while offering", async () => {
    const m = mockModel(() => " at the ford.");
    render(<Notice initial="Three hounds seen" model={m.model} />);
    expect(mark().getAttribute("aria-busy")).toBe("false");
    expect(mark().getAttribute("data-offering")).toBeNull();

    m.hold();
    await userEvent.click(mark());
    await waitFor(() => expect(mark().getAttribute("aria-busy")).toBe("true"));
    act(() => m.release());
    await waitFor(() => expect(mark().getAttribute("data-offering")).toBe("true"));
    expect(mark().getAttribute("aria-busy")).toBe("false");
  });
});

function Title(props: { model: ReturnType<typeof mockModel>["model"]; onEvent?: (e: AssistEvent) => void }) {
  const [value, setValue] = useState("Bog-hounds took the herd dog");
  return (
    <AssistProvider model={props.model} onEvent={props.onEvent}>
      <Field>
        <FieldLabel>Title</FieldLabel>
        <Assist onValueChange={setValue} value={value}>
          <Input />
        </Assist>
      </Field>
      <output data-testid="value">{value}</output>
    </AssistProvider>
  );
}

const CANDIDATES = elements([
  { value: "Bog-hounds on the causeway", rationale: "Names the place." },
  { value: "Herd dog taken at the ford", rationale: "Leads with the loss." },
]);

describe("Assist on an Input — whole values, as chips", () => {
  it("offers candidates under the field from the ✨, and a chip replaces the value", async () => {
    const { model } = mockModel(() => CANDIDATES);
    const onEvent = vi.fn();
    render(<Title model={model} onEvent={onEvent} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("textbox", { name: "Title" }));
    await user.click(mark());
    const chip = await screen.findByRole("button", { name: "Herd dog taken at the ford" });
    expect(chip.getAttribute("title")).toBe("Leads with the loss.");

    await user.click(chip);
    expect(value()).toBe("Herd dog taken at the ford");
    expect(onEvent.mock.calls.map(([e]) => e.kind)).toEqual(["shown", "shown", "accepted"]);
  });

  it("drops a chip with its ✕, as a rejection", async () => {
    const { model } = mockModel(() => CANDIDATES);
    const onEvent = vi.fn();
    render(<Title model={model} onEvent={onEvent} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    await user.click(mark());
    await user.click(await screen.findByRole("button", { name: "Dismiss Bog-hounds on the causeway" }));
    expect(screen.queryByRole("button", { name: "Bog-hounds on the causeway" })).toBeNull();
    expect(onEvent.mock.calls.at(-1)?.[0].kind).toBe("rejected");
  });

  it("asks for structured output, never prose to parse", async () => {
    const { model } = mockModel(() => CANDIDATES);
    render(<Title model={model} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    await user.click(mark());
    await screen.findByRole("button", { name: "Herd dog taken at the ford" });
    expect(model.doStreamCalls[0]?.responseFormat?.type).toBe("json");
  });
});

function Tags(props: { model: ReturnType<typeof mockModel>["model"] }) {
  const [tags, setTags] = useState(["livestock"]);
  return (
    <AssistProvider model={props.model}>
      <Assist onValueChange={setTags} value={tags}>
        <TagsInput>
          <TagsInputControl>
            <TagsInputContext>
              {(api) =>
                api.value.map((v, i) => (
                  <TagsInputItem index={i} key={v} value={v}>
                    <TagsInputItemPreview>
                      <TagsInputItemText>{v}</TagsInputItemText>
                    </TagsInputItemPreview>
                  </TagsInputItem>
                ))
              }
            </TagsInputContext>
            <TagsInputInput aria-label="Tags" />
          </TagsInputControl>
        </TagsInput>
      </Assist>
      <output data-testid="value">{tags.join(",")}</output>
    </AssistProvider>
  );
}

describe("Assist on a TagsInput — values to add", () => {
  it("adds a chip's value to the list, and never offers one already there", async () => {
    const { model } = mockModel(() =>
      elements([
        { value: "Livestock", rationale: "dup" },
        { value: "night-work", rationale: "Both sightings were at dusk." },
      ]),
    );
    render(<Tags model={model} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox", { name: "Tags" }));
    await user.click(mark());
    await user.click(await screen.findByRole("button", { name: "night-work" }));
    expect(value()).toBe("livestock,night-work");
    expect(screen.queryByRole("button", { name: "Livestock" })).toBeNull();
  });
});

describe("Assist when the model fails", () => {
  it("says so under the field and hands the provider's onFailure the thrown value", async () => {
    const thrown = Object.assign(new Error("the gateway refused"), { code: "llm/refused" });
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw thrown;
      },
    });
    const onFailure = vi.fn();
    function Failing() {
      const [value, setValue] = useState("");
      return (
        <AssistProvider model={model} onFailure={onFailure}>
          <Field>
            <FieldLabel>Notice</FieldLabel>
            <Assist onValueChange={setValue} value={value}>
              <Textarea />
            </Assist>
          </Field>
        </AssistProvider>
      );
    }
    render(<Failing />);
    const field = screen.getByRole("textbox", { name: "Notice" });
    fireEvent.change(field, { target: { value: "Three hounds seen", selectionStart: 17 } });
    await waitFor(() => expect(onFailure).toHaveBeenCalled(), { timeout: 2000 });
    expect(onFailure.mock.calls[0]?.[0]).toBe(thrown);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "the gateway refused");
    expect(ghostText()).toBe("");
  });
});

