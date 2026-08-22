import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning.js";

const Thinking = (props: { streaming?: boolean }) => (
  <Reasoning streaming={props.streaming}>
    <ReasoningTrigger />
    <ReasoningContent>Counting the contracts before ranking them.</ReasoningContent>
  </Reasoning>
);

const thoughts = () => screen.queryByText("Counting the contracts before ranking them.");

describe("Reasoning", () => {
  /**
   * It lingers before it folds. Closing on the instant the last token lands takes the end of the
   * thought away from whoever was reading it, and one beat is what makes the fold readable — AI
   * Elements waits the same second for the same reason.
   */
  it("opens itself while the model is thinking, and lingers before it folds", async () => {
    const { rerender } = render(<Thinking />);
    expect(thoughts()).toBeNull();

    rerender(<Thinking streaming />);
    await waitFor(() => expect(thoughts()).not.toBeNull());

    rerender(<Thinking />);
    // Still readable a moment after the stream ends.
    expect(thoughts()).not.toBeNull();
    await waitFor(() => expect(thoughts()).toBeNull(), { timeout: 2500 });
  });

  /**
   * A folded-away thought says nothing about itself unless the trigger does. **How long it thought
   * is the one fact it has**, and it is what gives a reader a reason to open it — a static
   * "Reasoning" gives none. Taken from AI Elements, which reads *Thought for N seconds*.
   */
  it("says how long it thought, once it has thought", async () => {
    const { rerender } = render(<Thinking />);
    expect(screen.getByRole("button").textContent).toBe("Reasoning");

    rerender(<Thinking streaming />);
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Thinking…"));

    rerender(<Thinking />);
    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toMatch(/^Thought for \d+ seconds?$/),
    );
  });

  // The whole point of the ref: a panel that reopens what somebody has just closed is worse than
  // one that never opened itself at all.
  it("stops opening itself once the reader has said otherwise", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Thinking streaming />);
    await waitFor(() => expect(thoughts()).not.toBeNull());

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(thoughts()).toBeNull());

    rerender(<Thinking />);
    rerender(<Thinking streaming />);
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Thinking…"));
    expect(thoughts()).toBeNull();
  });

  it("a reader may open it while nothing is streaming", async () => {
    const user = userEvent.setup();
    render(<Thinking />);

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(thoughts()).not.toBeNull());
  });

  it("names its parts", async () => {
    render(<Thinking streaming />);
    await waitFor(() => expect(thoughts()).not.toBeNull());

    expect(document.querySelector("[data-slot=reasoning]")?.getAttribute("data-streaming")).toBe("");
    expect(screen.getByRole("button").getAttribute("data-slot")).toBe("reasoning-trigger");
  });
});
