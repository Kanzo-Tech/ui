import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  CompleteError,
  CompleteGhost,
  CompleteHint,
  CompleteKeys,
  CompleteMark,
  CompleteRoot,
  CompleteTextarea,
} from "./complete.js";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@kanzo-tech/ui";
import { Textarea } from "@kanzo-tech/ui";

const completeRest = async function* (): AsyncIterable<string> {
  yield "o world";
};

function GhostHarness() {
  const [value, setValue] = useState("Hel");
  return (
    <CompleteRoot complete={completeRest} onValueChange={setValue} value={value}>
      <CompleteTextarea>
        <Textarea />
      </CompleteTextarea>
      <CompleteGhost />
    </CompleteRoot>
  );
}

function TextareaHarness() {
  const [value, setValue] = useState("Hel");
  return (
    <CompleteRoot complete={completeRest} onValueChange={setValue} value={value}>
      <CompleteTextarea>
        <Textarea />
      </CompleteTextarea>
      <CompleteHint />
    </CompleteRoot>
  );
}

/** The composition the mark is for: ✨ inside the field, in an addon. */
function MarkHarness() {
  const [value, setValue] = useState("Hel");
  return (
    <CompleteRoot complete={completeRest} onValueChange={setValue} value={value}>
      <InputGroup>
        <CompleteTextarea>
          <InputGroupTextarea />
        </CompleteTextarea>
        <InputGroupAddon align="inline-end">
          <CompleteMark />
        </InputGroupAddon>
      </InputGroup>
      <CompleteGhost />
    </CompleteRoot>
  );
}

const type = async (user: ReturnType<typeof userEvent.setup>) => {
  const field = screen.getByRole("textbox") as HTMLTextAreaElement;
  await user.click(field);
  await user.keyboard("l"); // "Hell" — clears the 4-char min-length gate, streams a ghost
  return field;
};

describe("Complete (inline ghost)", () => {
  it("streams an end-of-value ghost over a pure Textarea and Tab accepts it", async () => {
    const user = userEvent.setup();
    render(<GhostHarness />);

    const input = await type(user);
    await screen.findByText("o world");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(input.value).toBe("Hello world"));
  });

  it("streams the suggestion into a hint below the field, naming both keys", async () => {
    const user = userEvent.setup();
    render(<TextareaHarness />);

    const area = await type(user);
    await screen.findByText("o world");
    // The keys used to be one unlabelled <kbd>Tab</kbd>: what it did was a guess, and Esc was
    // announced nowhere at all.
    expect(screen.getByText("accept")).toBeTruthy();
    expect(screen.getByText("dismiss")).toBeTruthy();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(area.value).toBe("Hello world"));
  });

  it("takes one word at a time with the forward word key, and the rest survives", async () => {
    const user = userEvent.setup();
    render(<GhostHarness />);

    const input = await type(user);
    await screen.findByText("o world");

    await user.keyboard("{Control>}{ArrowRight}{/Control}");

    await waitFor(() => expect(input.value).toBe("Hello"));
    // Not a fresh request: the remainder of the same stream is still on offer.
    await screen.findByText("world");

    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    await waitFor(() => expect(input.value).toBe("Hello world"));
  });

  it("lets the offer go while text is selected, because a range has no insertion point", async () => {
    const user = userEvent.setup();
    render(<GhostHarness />);

    const input = await type(user);
    await screen.findByText("o world");

    // ⌘A. `selectionStart` is the HEAD of the range, so the ghost used to be redrawn at character
    // zero — on top of the sentence it was continuing — and Tab spliced it in there.
    input.setSelectionRange(0, input.value.length);
    fireEvent.select(input);

    await waitFor(() => expect(screen.queryByText("o world")).toBeNull());
  });

  it("announces that a suggestion is ready, once, without reading the stream", async () => {
    const user = userEvent.setup();
    const { container } = render(<GhostHarness />);

    const live = container.querySelector('[data-slot="complete-status"]');
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("");

    await type(user);
    await screen.findByText("o world");

    await waitFor(() => expect(live?.textContent).toContain("Tab"));
    // The ghost paints; it does not speak. Twenty frames of one sentence is not an announcement.
    expect(container.querySelector('[data-slot="complete-ghost"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});

describe("CompleteMark", () => {
  it("marks the field before there is anything to offer, and will not be a dead press", async () => {
    const user = userEvent.setup();
    render(<MarkHarness />);

    // "Hel" is under the min length, so `complete` cannot be asked yet — the mark still says the
    // field is assisted, and says so without a hover.
    const mark = screen.getByRole("button", { name: "AI assist" }) as HTMLButtonElement;
    expect(mark.getAttribute("data-slot")).toBe("ai-mark");
    expect(mark.disabled).toBe(true);

    await type(user);
    await waitFor(() => expect(mark.disabled).toBe(false));
  });

  it("lights when there is an offer, and accepting is a press as well as a key", async () => {
    const user = userEvent.setup();
    render(<MarkHarness />);

    const input = await type(user);
    await screen.findByText("o world");

    // The name carries the state, because the colour cannot.
    const mark = await screen.findByRole("button", { name: "Accept suggestion" });
    expect(mark.getAttribute("data-offering")).toBe("true");

    await user.click(mark);
    await waitFor(() => expect(input.value).toBe("Hello world"));
  });

  it("is the way back after Escape", async () => {
    const user = userEvent.setup();
    render(<MarkHarness />);

    await type(user);
    await screen.findByText("o world");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("o world")).toBeNull());

    // Without the mark, Escape ended the field's assistance until the next keystroke.
    await user.click(screen.getByRole("button", { name: "AI assist" }));
    await screen.findByText("o world");
  });
});

/** A source that fails on the first pull, which is what a dead endpoint looks like from here. */
const completeFails = (): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.reject(new Error("The model is unreachable.")),
  }),
});

function ErrorHarness() {
  // Long enough to be askable: the ✨ is disabled below `MIN_COMPLETE_LENGTH`.
  const [value, setValue] = useState("Hello");
  return (
    <CompleteRoot complete={completeFails} onValueChange={setValue} value={value}>
      <InputGroup>
        <CompleteTextarea>
          <InputGroupTextarea />
        </CompleteTextarea>
        <InputGroupAddon align="inline-end">
          <CompleteMark />
        </InputGroupAddon>
      </InputGroup>
      <CompleteGhost />
      <CompleteError />
    </CompleteRoot>
  );
}

describe("CompleteError", () => {
  it("says what went wrong, where `Suggest` always did and this side said nothing", async () => {
    const user = userEvent.setup();
    render(<ErrorHarness />);
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "AI assist" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("The model is unreachable."),
    );
  });
});


const completePrefix = async function* (): AsyncIterable<string> {
  yield "Three ";
};

function MidValueHarness() {
  const [value, setValue] = useState("hounds at the ford");
  return (
    <CompleteRoot complete={completePrefix} onValueChange={setValue} value={value}>
      <InputGroup>
        <CompleteTextarea>
          <InputGroupTextarea />
        </CompleteTextarea>
        <InputGroupAddon align="inline-end">
          <CompleteMark />
        </InputGroupAddon>
      </InputGroup>
      <CompleteGhost />
      <CompleteKeys />
    </CompleteRoot>
  );
}

describe("an offer is made at the caret", () => {
  it("completes in the middle of a value, where an append could not", async () => {
    const user = userEvent.setup();
    render(<MidValueHarness />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;

    await user.click(field);
    await user.keyboard("{Home}");
    expect(field.selectionStart).toBe(0);

    // The keys are not on screen until there is something to take.
    expect(screen.queryByText("accept")).toBeNull();

    const mark = screen.getByRole("button", { name: "AI assist" });
    await user.click(mark);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Accept suggestion" })).toBeTruthy(),
    );
    expect(screen.getByText("accept")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Accept suggestion" }));
    // Inserted at 0, not appended at the end.
    await waitFor(() => expect(field.value).toBe("Three hounds at the ford"));
  });
});


/** A source that yields nothing until it is let go. */
function gate(values: string[]) {
  let release!: () => void;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release: () => release(),
    source: async function* (): AsyncGenerator<string> {
      await open;
      for (const value of values) yield value;
    },
  };
}

const long = gate([" and the ford is standing water from the lane to the causeway"]);

function GrowHarness() {
  const [value, setValue] = useState("Three hounds seen at the ford");
  return (
    <CompleteRoot complete={long.source} onValueChange={setValue} value={value}>
      <InputGroup>
        <CompleteTextarea>
          <Textarea rows={2} />
        </CompleteTextarea>
        <InputGroupAddon align="inline-end">
          <CompleteMark />
        </InputGroupAddon>
      </InputGroup>
      <CompleteGhost />
    </CompleteRoot>
  );
}

describe("a continuation that does not fit", () => {
  it("makes the field taller instead of being cut, and gives the height back", async () => {
    const user = userEvent.setup();
    render(<GrowHarness />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    const mirror = document.querySelector('[data-slot="complete-ghost"]') as HTMLElement;
    // jsdom does no layout, so the one measurement this turns on is supplied by hand — the same
    // trick `conversation.test.tsx` uses for a scroll box.
    Object.defineProperty(mirror, "scrollHeight", { configurable: true, value: 200 });

    expect(field.style.getPropertyValue("min-height")).toBe("");

    await user.click(screen.getByRole("button", { name: "AI assist" }));
    long.release();
    await waitFor(() => expect(field.style.getPropertyValue("min-height")).toBe("200px"));

    // Escape drops the offer, and the field is a field again.
    field.focus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(field.style.getPropertyValue("min-height")).toBe(""));
  });
});
