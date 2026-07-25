import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SuggestContent, SuggestRoot, SuggestTrigger } from "./suggest.js";
import type { Suggestion } from "./use-ai.js";

const suggest = async function* (): AsyncIterable<Suggestion> {
  yield { value: "alpha" };
  yield { value: "beta" };
};

function Harness(props: {
  onPick?: (v: string) => void;
  src?: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
}) {
  const { onPick = vi.fn(), src = suggest } = props;
  return (
    <SuggestRoot onPick={onPick} suggest={src}>
      <SuggestTrigger label="Suggest" />
      <SuggestContent />
    </SuggestRoot>
  );
}

describe("Suggest", () => {
  it("opening starts the stream and lists candidates; picking calls onPick and closes", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    const alpha = await screen.findByText("alpha");
    await user.click(alpha);

    expect(onPick).toHaveBeenCalledWith("alpha");
    await waitFor(() => expect(screen.queryByText("beta")).toBeNull());
  });

  it("dismissing a candidate removes it from the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    await screen.findByText("alpha");
    const dismiss = screen.getAllByRole("button", { name: "Dismiss suggestion" })[0]!;
    await user.click(dismiss);

    await waitFor(() => expect(screen.queryByText("alpha")).toBeNull());
  });

  it("closing mid-load cancels the in-flight stream", async () => {
    const user = userEvent.setup();
    let aborted = false;
    const slow = async function* (signal?: AbortSignal): AsyncIterable<Suggestion> {
      signal?.addEventListener("abort", () => {
        aborted = true;
      });
      yield { value: "one" };
      await new Promise((r) => setTimeout(r, 2000));
    };
    render(<Harness src={slow} />);

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    await screen.findByText("one");
    // `keyboard` dispatches at `document.activeElement`, and Ark moves focus into the content a
    // tick after opening. Pressing Escape before that lands it on the old element and the popover
    // never closes — the flake this test had.
    const content = await screen.findByRole("dialog");
    await waitFor(() => expect(content.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(aborted).toBe(true));
  });
});
