import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@kanzo-tech/ui";
import { SuggestList, SuggestMark, SuggestRoot } from "./suggest.js";
import type { Candidate } from "./types.js";

const suggest = async function* (): AsyncIterable<Candidate> {
  yield { value: "alpha", rationale: "the first letter" };
  yield { value: "beta" };
};

function Harness(props: {
  existing?: string[];
  onPick?: (v: string) => void;
  src?: (signal?: AbortSignal) => AsyncIterable<Candidate>;
  trigger?: "press" | "focus";
}) {
  const { existing, onPick = vi.fn(), src = suggest, trigger } = props;
  return (
    <SuggestRoot existing={existing} onPick={onPick} suggest={src} trigger={trigger}>
      <Input aria-label="Tag" />
      <SuggestMark label="Suggest" />
      <SuggestList />
    </SuggestRoot>
  );
}

const mark = () => screen.getByRole("button", { name: "Suggest" });

describe("Suggest", () => {
  it("wears the same mark the Complete compound does", () => {
    render(<Harness />);
    expect(mark().getAttribute("data-slot")).toBe("ai-mark");
  });

  /**
   * The candidates are BUTTONS, in the flow, in document order — not options in a listbox behind a
   * popover. Picking one leaves a value in a field and no selection anywhere, which makes it a
   * command and not a value; the version this replaced pinned a listbox's `value` to an empty
   * array forever to say the same thing.
   */
  it("offers candidates as buttons, and picking one commits its value", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    await user.click(mark());
    await user.click(await screen.findByRole("button", { name: "alpha" }));

    expect(onPick).toHaveBeenCalledWith("alpha");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("takes a picked candidate off the strip, and leaves the rest", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(mark());
    await user.click(await screen.findByRole("button", { name: "alpha" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "alpha" })).toBeNull());
    expect(screen.getByRole("button", { name: "beta" })).not.toBeNull();
  });

  /**
   * **A candidate can be refused without being taken, and until now it could not.**
   * `useSuggestions` has returned `dismiss(value)` from the start and `SuggestRoot` has put it on
   * the context from the start; no part called it, so the capability was wired end to end and drawn
   * nowhere. The ✕ went with the popover this compound replaced and never came back.
   *
   * The dismiss is a SIBLING of the pill, not a child of it: `Candidate` is a `<button>`, and the
   * DOM has no button inside a button.
   */
  it("refuses a candidate without taking it, and leaves the rest", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    await user.click(mark());
    await user.click(await screen.findByRole("button", { name: "Dismiss alpha" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "alpha" })).toBeNull());
    expect(screen.getByRole("button", { name: "beta" })).not.toBeNull();
    // Refusing is not picking. The field's value never moved.
    expect(onPick).not.toHaveBeenCalled();
  });

  /**
   * Visibility is focus and billing is a press, and they are not the same gesture. This is the
   * clause that keeps a form of eleven fields from becoming a wall of strips: only one field holds
   * focus, so only one strip is ever on screen.
   */
  it("hides the strip when focus leaves the field entirely", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.click(mark());
    await screen.findByRole("button", { name: "alpha" });

    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "alpha" })).toBeNull());
  });

  it("does not ask on focus unless it was told to", async () => {
    const user = userEvent.setup();
    const src = vi.fn(suggest);
    render(<Harness src={src} />);

    await user.click(screen.getByRole("textbox", { name: "Tag" }));
    expect(src).not.toHaveBeenCalled();

    await user.click(mark());
    await screen.findByRole("button", { name: "alpha" });
    expect(src).toHaveBeenCalledTimes(1);
  });

  it("asks on focus when it was", async () => {
    const user = userEvent.setup();
    const src = vi.fn(suggest);
    render(<Harness src={src} trigger="focus" />);

    await user.click(screen.getByRole("textbox", { name: "Tag" }));
    await screen.findByRole("button", { name: "alpha" });
    expect(src).toHaveBeenCalledTimes(1);
  });

  it("never offers back what the field already holds", async () => {
    const user = userEvent.setup();
    render(<Harness existing={["ALPHA"]} />);

    await user.click(mark());
    await screen.findByRole("button", { name: "beta" });
    expect(screen.queryByRole("button", { name: "alpha" })).toBeNull();
  });

  /**
   * The rationale rides as the pill's `title`. It was a line under the strip first, and that line
   * moved the layout on every hover; a `title` is the browser's own tooltip and costs no box.
   */
  it("carries the rationale on the pill that has one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(mark());
    const alpha = await screen.findByRole("button", { name: "alpha" });
    expect(alpha.getAttribute("title")).toBe("the first letter");
    expect(screen.getByRole("button", { name: "beta" }).getAttribute("title")).toBeNull();
  });

  it("says so when the source had nothing", async () => {
    const user = userEvent.setup();
    const empty = async function* (): AsyncIterable<Candidate> {};
    render(<Harness src={empty} />);

    await user.click(mark());
    expect(await screen.findByText("Nothing to suggest.")).not.toBeNull();
  });
});
