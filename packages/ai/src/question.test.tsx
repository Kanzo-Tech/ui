import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Question, QuestionDescription, QuestionOption, QuestionOptions, QuestionPrompt } from "./question.js";

const decision = {
  id: "prize",
  question: "What is a prize's amount?",
  options: [
    { id: "whole", label: "The whole prize" },
    { id: "share", label: "A fraction of the prize" },
  ],
};

function Decide(props: { value?: string; onChoose?: (option: string) => void }) {
  return (
    <Question onValueChange={(d) => d.value && props.onChoose?.(d.value)} value={props.value ?? null}>
      <QuestionPrompt>{decision.question}</QuestionPrompt>
      <QuestionDescription>It decides how amounts add up.</QuestionDescription>
      <QuestionOptions>
        {decision.options.map((option) => (
          <QuestionOption key={option.id} value={option.id}>
            {option.label}
          </QuestionOption>
        ))}
      </QuestionOptions>
    </Question>
  );
}

describe("Question", () => {
  it("is a radio group named by its prompt, an option per radio", () => {
    render(<Decide />);
    expect(screen.getByRole("radiogroup", { name: decision.question })).not.toBeNull();
    expect(screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([
      "The whole prize",
      "A fraction of the prize",
    ]);
  });

  it("answers with the option picked, in one press, and draws the answer it is given", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Decide onChoose={onChoose} />);
    await user.click(screen.getByText("A fraction of the prize"));
    expect(onChoose).toHaveBeenLastCalledWith("share");
    rerender(<Decide onChoose={onChoose} value="share" />);
    expect(screen.getByRole("radio", { name: "A fraction of the prize" })).toHaveProperty("checked", true);
    expect(document.querySelector("[data-slot=question-option][data-state=checked]")?.textContent).toBe("A fraction of the prize");
  });

  it("moves between the options with the arrow keys, choosing as it moves", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<Decide onChoose={onChoose} value="whole" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "The whole prize" }));
    await user.keyboard("{ArrowDown}");
    expect(onChoose).toHaveBeenLastCalledWith("share");
  });
});
