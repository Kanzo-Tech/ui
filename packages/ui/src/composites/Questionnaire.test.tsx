import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTextarea,
  QuestionnaireTitle,
  type QuestionnaireAnswers,
  type QuestionnaireProps,
} from "./Questionnaire.js";

/**
 * Four questions, one of each kind the composite claims to support: a required single choice, a
 * required multiple choice, a skippable freeform answer, and an optional single choice last so that
 * `QuestionnaireSubmit` has a question to appear on.
 *
 * Four and not three because progress is `step / count`: with four the machine's own percentages are
 * whole numbers, and an assertion that has to round is one that would pass on the wrong value.
 */
function Survey(props: QuestionnaireProps = {}) {
  return (
    <Questionnaire {...props}>
      <QuestionnaireProgress />

      <QuestionnaireItem name="beast" required>
        <QuestionnaireTitle>What did you meet</QuestionnaireTitle>
        <QuestionnaireChoices>
          <QuestionnaireChoice description="Long, and it was already awake." value="wyrm">
            Wyrm
          </QuestionnaireChoice>
          <QuestionnaireChoice value="mimic">Mimic</QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>

      <QuestionnaireItem multiple name="kit" required>
        <QuestionnaireTitle>What did you carry</QuestionnaireTitle>
        <QuestionnaireChoices>
          <QuestionnaireChoice description="Forty feet, and it held." value="rope">
            Rope
          </QuestionnaireChoice>
          <QuestionnaireChoice value="wards">Wards</QuestionnaireChoice>
          <QuestionnaireChoice value="oil">Oil</QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>

      <QuestionnaireItem name="notes" skippable>
        <QuestionnaireTitle>Anything for the next party</QuestionnaireTitle>
        <QuestionnaireTextarea />
      </QuestionnaireItem>

      <QuestionnaireItem name="again">
        <QuestionnaireTitle>Would you take it again</QuestionnaireTitle>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="yes">Yes</QuestionnaireChoice>
          <QuestionnaireChoice value="no">No</QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>

      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireSkip />
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  );
}

/**
 * The question on screen. Every other item is `hidden`, so this selector is also the assertion that
 * only one is — `asked()` reading `null` means the composite hid all four.
 *
 * Everything below reads the DOM rather than `getByRole("checkbox", …)`, and that is forced: our
 * `Checkbox` puts `role="checkbox"` on Ark's `<label>` root *and* renders a hidden
 * `<input type="checkbox">` inside it, so a role query for one option matches two elements. The
 * input is the one carrying `checked`, so it is the one worth naming.
 */
const shown = () =>
  document.querySelector<HTMLElement>("[data-slot=questionnaire-item]:not([hidden])");
const asked = () => shown()?.querySelector("legend")?.textContent ?? null;
const choice = (value: string) =>
  shown()?.querySelector<HTMLInputElement>(`input[value="${value}"]`) ?? null;
const checked = (value: string) => choice(value)?.checked ?? null;
const keys = () => [...(shown()?.querySelectorAll("[data-slot=kbd]") ?? [])].map((k) => k.textContent);

const button = (name: string) => screen.getByRole("button", { name });
const progressbar = () => screen.getByRole("progressbar");
/** The question's position, 1-based — the same number the eye reads off the eyebrow. */
const progress = () => progressbar().getAttribute("aria-valuenow");
const card = (value: string) => choice(value)?.closest("[data-slot=questionnaire-choice]") ?? null;

describe("Questionnaire", () => {
  it("asks one question at a time", () => {
    render(<Survey />);

    expect(document.querySelectorAll("[data-slot=questionnaire-item]:not([hidden])")).toHaveLength(
      1,
    );
    expect(asked()).toBe("What did you meet");
    expect(choice("rope")).toBeNull();
  });

  it("names the question from its own legend, and each choice from its own text", () => {
    render(<Survey />);

    // Ark's fieldset points the group at its legend; nothing here writes the name twice. That is
    // the whole reason a question is a `FieldSet` rather than a heading over a radio group.
    const group = screen.getByRole("radiogroup");
    const legend = document.getElementById(group.getAttribute("aria-labelledby") ?? "");
    expect(legend?.tagName).toBe("LEGEND");
    expect(legend?.textContent).toBe("What did you meet");
    expect(screen.getByRole("radio", { name: "Mimic" })).toBeTruthy();
  });

  describe("a choice is a card", () => {
    it("puts the control, the label and its description in one row the whole of which is the target", () => {
      render(<Survey />);

      const wyrm = card("wyrm") as HTMLElement;
      // The card IS the control's label, which is what makes the whole of it clickable.
      expect(wyrm.tagName).toBe("LABEL");
      expect(wyrm.querySelector("[data-slot=radio-group-indicator]")).not.toBeNull();
      expect(
        wyrm.querySelector("[data-slot=questionnaire-choice-title]")?.textContent,
      ).toBe("Wyrm");
      expect(
        wyrm.querySelector("[data-slot=questionnaire-choice-description]")?.textContent,
      ).toBe("Long, and it was already awake.");

      // A choice given no description grows no empty second line.
      expect(
        (card("mimic") as HTMLElement).querySelector(
          "[data-slot=questionnaire-choice-description]",
        ),
      ).toBeNull();
    });

    it("names the choice from its label alone, description and all", () => {
      render(<Survey />);

      // The description sits inside the same `<label>`, so a name taken from the label's text
      // would read both lines. Ark points the radio at its own item text instead.
      expect(screen.getByRole("radio", { name: "Wyrm" })).toBeTruthy();
    });

    it("names a multiple choice the same way, where Ark's label part is not rendered", async () => {
      const user = userEvent.setup();
      render(<Survey />);

      await user.click(choice("wyrm") as HTMLInputElement);
      await user.click(button("Next"));

      const rope = card("rope") as HTMLElement;
      expect(rope.tagName).toBe("LABEL");
      expect(rope.querySelector("[data-slot=checkbox-control]")).not.toBeNull();
      expect(screen.getByRole("checkbox", { name: "Rope" })).toBeTruthy();
      expect(
        rope.querySelector("[data-slot=questionnaire-choice-description]")?.textContent,
      ).toBe("Forty feet, and it held.");
    });

    it("carries the shortcut chip inside the card, not beside it", () => {
      render(<Survey shortcuts />);

      const chip = (card("wyrm") as HTMLElement).querySelector("[data-slot=kbd]");
      expect(chip?.textContent).toBe("1");
      expect(chip?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("walks forward and back, and remembers what was answered on the way", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    expect(asked()).toBe("What did you carry");

    await user.click(button("Back"));
    expect(asked()).toBe("What did you meet");
    expect(checked("wyrm")).toBe(true);
  });

  it("offers no Back on the first question, so the row is one solid Next", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(
      document.querySelectorAll("[data-slot=questionnaire-actions] button"),
    ).toHaveLength(1);

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeNull();
  });

  it("refuses Next on a required question, and says why", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    await user.click(button("Next"));

    expect(asked()).toBe("What did you meet");
    const error = screen.getByText("Answer this to continue.");
    // Ark's fieldset owns the announcement — the error is live and the group points at it. Nothing
    // here declares a role of its own, which is the reason a question is a `FieldSet` at all.
    expect(error.getAttribute("aria-live")).toBe("polite");
    expect(shown()?.getAttribute("aria-describedby")).toContain(error.getAttribute("id"));
  });

  it("clears the refusal as soon as the question is answered", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    await user.click(button("Next"));
    expect(screen.queryByText("Answer this to continue.")).not.toBeNull();

    await user.click(choice("wyrm") as HTMLInputElement);
    expect(screen.queryByText("Answer this to continue.")).toBeNull();
  });

  it("lets a skippable question through unanswered, and offers a Skip only there", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    await user.click(choice("rope") as HTMLInputElement);
    await user.click(button("Next"));

    expect(asked()).toBe("Anything for the next party");
    // Skippable, so Next passes with an empty answer — and the Skip beside it is the same move
    // spelled for the reader.
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeNull();
    await user.click(button("Next"));
    expect(asked()).toBe("Would you take it again");
  });

  it("accumulates a multiple-choice answer instead of replacing it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Survey onSubmit={onSubmit} />);

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));

    // The checkbox is named by the label beside it, not by text inside it — `Checkbox` renders
    // Ark's control and hidden input as its own children, so text passed to it never arrives.
    const rope = choice("rope") as HTMLInputElement;
    expect(
      document.getElementById(rope.getAttribute("aria-labelledby") ?? "")?.textContent,
    ).toBe("Rope");

    await user.click(rope);
    await user.click(choice("oil") as HTMLInputElement);
    expect(checked("rope")).toBe(true);
    expect(checked("oil")).toBe(true);

    await user.click(button("Next"));
    await user.click(button("Skip"));
    await user.click(button("Submit"));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ beast: "wyrm", kit: ["rope", "oil"] });
  });

  it("unchecks a multiple-choice answer that is chosen twice", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    await user.click(choice("wards") as HTMLInputElement);
    await user.click(choice("wards") as HTMLInputElement);

    expect(checked("wards")).toBe(false);
    // …and an emptied multiple choice is unanswered again, so the required question blocks.
    await user.click(button("Next"));
    expect(asked()).toBe("What did you carry");
  });

  it("reads the position as a sentence, and moves it with the question", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    // The eyebrow and the ARIA say the same thing: a progressbar counting questions, not percent.
    expect(progressbar().textContent).toBe("Question 1 of 4");
    expect(progressbar().getAttribute("aria-valuetext")).toBe("Question 1 of 4");
    expect(progressbar().getAttribute("aria-valuemin")).toBe("1");
    expect(progressbar().getAttribute("aria-valuemax")).toBe("4");
    expect(progress()).toBe("1");

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    expect(progress()).toBe("2");

    await user.click(choice("rope") as HTMLInputElement);
    await user.click(button("Next"));
    expect(progress()).toBe("3");

    await user.click(button("Skip"));
    expect(progressbar().textContent).toBe("Question 4 of 4");
    expect(progress()).toBe("4");
  });

  it("swaps Next for Submit on the last question", async () => {
    const user = userEvent.setup();
    render(<Survey />);

    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();

    await user.click(choice("wyrm") as HTMLInputElement);
    await user.click(button("Next"));
    await user.click(choice("rope") as HTMLInputElement);
    await user.click(button("Next"));
    await user.click(button("Skip"));

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeNull();
  });

  it("submits the freeform answer with the rest of the payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Survey onSubmit={onSubmit} />);

    await user.click(choice("mimic") as HTMLInputElement);
    await user.click(button("Next"));
    await user.click(choice("wards") as HTMLInputElement);
    await user.click(button("Next"));
    await user.type(screen.getByRole("textbox"), "Bring rope.");
    await user.click(button("Next"));
    await user.click(choice("no") as HTMLInputElement);
    await user.click(button("Submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      beast: "mimic",
      kit: ["wards"],
      notes: "Bring rope.",
      again: "no",
    });
  });

  it("starts where a parent left off, which is what resuming a saved session is", () => {
    const answers: QuestionnaireAnswers = { beast: "wyrm" };
    render(<Survey defaultAnswers={answers} defaultStep={1} />);

    expect(asked()).toBe("What did you carry");
    expect(progress()).toBe("2");
  });

  it("reports every answer as it is made, so a parent can persist without submitting", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    render(<Survey onAnswersChange={onAnswersChange} />);

    await user.click(choice("wyrm") as HTMLInputElement);

    expect(onAnswersChange.mock.calls.at(-1)?.[0]).toEqual({ beast: "wyrm" });
  });

  describe("shortcuts", () => {
    it("draws no key and claims none until it is asked to", async () => {
      const user = userEvent.setup();
      render(<Survey />);

      expect(document.querySelector("[data-slot=kbd]")).toBeNull();

      await user.keyboard("2");
      expect(checked("mimic")).toBe(false);
    });

    it("answers the visible question by position, and shows the key it used", async () => {
      const user = userEvent.setup();
      render(<Survey shortcuts />);

      expect(keys()).toEqual(["1", "2"]);

      await user.keyboard("2");
      expect(checked("mimic")).toBe(true);
    });

    it("keeps working once a choice has focus, which is where the naive guard fails", async () => {
      const user = userEvent.setup();
      render(<Survey shortcuts />);

      // Ark parks focus on the hidden `<input type="radio">`, so "focus is in an input" would read
      // as typing and switch the shortcuts off the moment somebody clicked an option.
      await user.click(choice("wyrm") as HTMLInputElement);
      expect((document.activeElement as HTMLElement | null)?.tagName).toBe("INPUT");

      await user.keyboard("2");
      expect(checked("mimic")).toBe(true);
    });

    it("toggles a multiple-choice answer rather than replacing it", async () => {
      const user = userEvent.setup();
      render(<Survey shortcuts />);

      await user.keyboard("1");
      await user.click(button("Next"));

      await user.keyboard("1");
      await user.keyboard("3");
      expect(checked("rope")).toBe(true);
      expect(checked("oil")).toBe(true);

      await user.keyboard("1");
      expect(checked("rope")).toBe(false);
    });

    it("stands aside while a freeform answer is being typed", async () => {
      const user = userEvent.setup();
      render(<Survey shortcuts />);

      await user.keyboard("1");
      await user.click(button("Next"));
      await user.keyboard("1");
      await user.click(button("Next"));

      await user.type(screen.getByRole("textbox"), "1 rope, 2 wards");

      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("1 rope, 2 wards");
      // Still on the freeform question: nothing was answered behind the reader's back.
      expect(asked()).toBe("Anything for the next party");
    });
  });
});
