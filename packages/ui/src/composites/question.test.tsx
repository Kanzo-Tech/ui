import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Question,
  QuestionChoice,
  QuestionChoices,
  QuestionDescription,
  QuestionError,
  QuestionInput,
  QuestionPrompt,
  type QuestionAnswer,
} from "./question.js";

/** A Task's `Decision`, the shape a guided chat asks one per turn. */
const decision = {
  id: "prize",
  question: "What is a prize's amount?",
  options: [
    { id: "whole", label: "The whole prize" },
    { id: "share", label: "A fraction of the prize" },
  ],
};

function Decide(props: { value?: QuestionAnswer | null; onChoose?: (option: QuestionAnswer) => void }) {
  return (
    <Question name={decision.id} onValueChange={(d) => props.onChoose?.(d.value)} value={props.value}>
      <QuestionPrompt>{decision.question}</QuestionPrompt>
      <QuestionDescription>It decides how amounts add up.</QuestionDescription>
      <QuestionChoices>
        {decision.options.map((option) => (
          <QuestionChoice key={option.id} value={option.id}>
            {option.label}
          </QuestionChoice>
        ))}
      </QuestionChoices>
    </Question>
  );
}

describe("Question", () => {
  it("is a radio group named by its prompt, a choice per radio, outside any questionnaire", () => {
    render(<Decide />);
    expect(screen.getByRole("radiogroup", { name: decision.question })).not.toBeNull();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["whole", "share"]);
    expect(screen.getByRole("radio", { name: "A fraction of the prize" })).toBeTruthy();
    // On its own it is the one question, so it is never hidden and is no step of anything.
    const group = document.querySelector<HTMLElement>("[data-slot=question]");
    expect(group?.hidden).toBe(false);
    expect(group?.getAttribute("aria-current")).toBeNull();
  });

  it("answers with the choice picked, in one press, and draws the answer it is given", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Decide onChoose={onChoose} value={null} />);
    await user.click(screen.getByText("A fraction of the prize"));
    expect(onChoose).toHaveBeenLastCalledWith("share");
    rerender(<Decide onChoose={onChoose} value="share" />);
    expect(screen.getByRole("radio", { name: "A fraction of the prize" })).toHaveProperty("checked", true);
    expect(document.querySelector("[data-slot=question-choice][data-state=checked]")?.textContent).toBe("A fraction of the prize");
  });

  it("keeps its own answer when it is given none to draw", async () => {
    const user = userEvent.setup();
    render(<Decide />);
    await user.click(screen.getByText("The whole prize"));
    expect(screen.getByRole("radio", { name: "The whole prize" })).toHaveProperty("checked", true);
  });

  it("moves between the choices with the arrow keys, choosing as it moves", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<Decide onChoose={onChoose} value="whole" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "The whole prize" }));
    await user.keyboard("{ArrowDown}");
    expect(onChoose).toHaveBeenLastCalledWith("share");
  });

  it("takes a typed answer, named by its prompt, and files it under its name", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <form>
        <Question name="threshold" onValueChange={onValueChange}>
          <QuestionPrompt>From how many prizes is a laureate prolific?</QuestionPrompt>
          <QuestionInput />
        </Question>
      </form>,
    );
    const input = screen.getByRole("textbox", { name: "From how many prizes is a laureate prolific?" });
    expect(input.getAttribute("name")).toBe("threshold");
    await user.type(input, "3");
    expect(onValueChange).toHaveBeenLastCalledWith({ value: "3" });
  });

  it("says why it is unanswered in its own words, only while it is invalid", () => {
    const { rerender } = render(
      <Question name="prize" translations={{ unanswered: "Elige una." }}>
        <QuestionPrompt>{decision.question}</QuestionPrompt>
        <QuestionError />
      </Question>,
    );
    expect(screen.queryByText("Elige una.")).toBeNull();
    rerender(
      <Question invalid name="prize" translations={{ unanswered: "Elige una." }}>
        <QuestionPrompt>{decision.question}</QuestionPrompt>
        <QuestionError />
      </Question>,
    );
    expect(screen.getByText("Elige una.").getAttribute("aria-live")).toBe("polite");
  });
});
