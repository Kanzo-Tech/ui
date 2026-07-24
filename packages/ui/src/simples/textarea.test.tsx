import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AiAssist } from "./ai-assist.js";
import { Textarea } from "./textarea.js";

const completeWorld = async function* (): AsyncIterable<string> {
  yield " world";
};

function Harness() {
  const [value, setValue] = useState("hello");
  return (
    <AiAssist complete={completeWorld} debounceMs={0} minLength={1}>
      <Textarea aiComplete onChange={(e) => setValue(e.target.value)} value={value} />
    </AiAssist>
  );
}

describe("Textarea aiComplete", () => {
  it("renders an end-of-value ghost overlay and Tab accepts it into the value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.click(area);
    await user.keyboard(" "); // fire a change so the completion streams a ghost

    // The muted ghost span mirrors the streamed continuation.
    await screen.findByText("world");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(area.value).toBe("hello  world"));
  });

  it("renders a plain textarea (no overlay) when aiComplete is absent", () => {
    render(<Textarea value="x" onChange={() => {}} />);
    const area = screen.getByRole("textbox");
    expect(area.getAttribute("data-slot")).toBe("textarea");
    expect(area.parentElement?.getAttribute("data-slot")).not.toBe("textarea-ai");
  });
});
