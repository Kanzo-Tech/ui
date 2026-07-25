import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  CompleteGhost,
  CompleteHint,
  CompleteInput,
  CompleteRoot,
  CompleteTextarea,
} from "./complete.js";
import { Input } from "./input.js";
import { Textarea } from "./textarea.js";

const completeRest = async function* (): AsyncIterable<string> {
  yield "o world";
};

function InputHarness() {
  const [value, setValue] = useState("Hel");
  return (
    <CompleteRoot complete={completeRest} onValueChange={setValue} value={value}>
      <CompleteInput>
        <Input />
      </CompleteInput>
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

describe("Complete (inline ghost)", () => {
  it("streams an end-of-value ghost over a pure Input and Tab accepts it", async () => {
    const user = userEvent.setup();
    render(<InputHarness />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("l"); // "Hell" — clears the 4-char min-length gate, streams a ghost

    await screen.findByText("o world");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(input.value).toBe("Hello world"));
  });

  it("streams the suggestion into a hint below a pure Textarea", async () => {
    const user = userEvent.setup();
    render(<TextareaHarness />);

    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.click(area);
    await user.keyboard("l");

    await screen.findByText("o world");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(area.value).toBe("Hello world"));
  });
});
