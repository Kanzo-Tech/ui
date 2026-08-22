import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@kanzo-tech/ui";
import { CompleteMark, CompleteRoot, CompleteTextarea } from "./complete.js";
import { SuggestMark, SuggestRoot } from "./suggest.js";
import type { Suggestion } from "./types.js";

/** A source that yields nothing until it is let go, so the busy phase can be observed. */
function gate<T>(values: T[]) {
  let release!: () => void;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release: () => release(),
    source: async function* (): AsyncGenerator<T> {
      await open;
      for (const value of values) yield value;
    },
  };
}

/** Everything the mark says about the state it is in. */
const paint = (el: HTMLElement) => ({
  offering: el.getAttribute("data-offering"),
  busy: el.getAttribute("aria-busy"),
});

const ghost = gate(["o world"]);
const candidates = gate<Suggestion>([{ value: "livestock" }, { value: "night-work" }]);

function CompleteHarness() {
  const [value, setValue] = useState("Hell");
  return (
    <CompleteRoot complete={ghost.source} onValueChange={setValue} value={value}>
      <InputGroup>
        <CompleteTextarea>
          <InputGroupTextarea />
        </CompleteTextarea>
        <InputGroupAddon align="inline-end">
          <CompleteMark />
        </InputGroupAddon>
      </InputGroup>
    </CompleteRoot>
  );
}

function SuggestHarness() {
  return (
    <SuggestRoot onPick={() => {}} suggest={candidates.source}>
      <SuggestMark />
    </SuggestRoot>
  );
}

/**
 * The same glyph in the same state must say the same thing, whichever compound wears it.
 *
 * It did not: `SuggestMark` never set `offering` at all, so a strip full of candidates left the
 * mark at rest while a ghost lit it, and its `busy` was a bare `loading` that spun on top of
 * candidates already on screen. Two bindings of one idea is how a library stops reading as one.
 */
describe("AiMark paints the same in both compounds", () => {
  it("goes rest → busy → offering identically over a ghost and over a strip", async () => {
    const user = userEvent.setup();

    const complete = render(<CompleteHarness />);
    const completeMark = screen.getByRole("button");
    const completeRest = paint(completeMark);
    await user.click(completeMark);
    const completeBusy = paint(completeMark);
    ghost.release();
    await waitFor(() => expect(completeMark.getAttribute("data-offering")).toBe("true"));
    const completeOffering = paint(completeMark);
    complete.unmount();

    const suggest = render(<SuggestHarness />);
    const suggestMark = screen.getByRole("button");
    const suggestRest = paint(suggestMark);
    await user.click(suggestMark);
    const suggestBusy = paint(suggestMark);
    candidates.release();
    await waitFor(() => expect(suggestMark.getAttribute("data-offering")).toBe("true"));
    const suggestOffering = paint(suggestMark);
    suggest.unmount();

    expect(suggestRest).toEqual(completeRest);
    expect(suggestBusy).toEqual(completeBusy);
    expect(suggestOffering).toEqual(completeOffering);

    // And the three are actually distinct, so an all-null comparison cannot pass this by accident.
    // `aria-busy="false"` rather than absent because `Button` writes the attribute either way; what
    // `AiMark` owns is `data-offering`, which it omits when there is nothing on offer.
    expect(completeRest).toEqual({ offering: null, busy: "false" });
    expect(completeBusy).toEqual({ offering: null, busy: "true" });
    expect(completeOffering).toEqual({ offering: "true", busy: "false" });
  });
});
