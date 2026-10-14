"use client";

import { ark } from "@ark-ui/react/factory";
import { useSteps, type UseStepsReturn } from "@ark-ui/react/steps";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { Button, type ButtonProps } from "../simples/button.js";
import {
  collect,
  Question,
  type QuestionAnswer,
  type QuestionnaireQuestion,
  type QuestionProps,
  QuestionSequenceContext,
  type QuestionTranslations,
} from "./question.js";

/**
 * Questionnaire — several questions, one at a time, with progress, validation and navigation. The
 * questions are the question part, `Question`; this is the sequence around them.
 *
 *   <Questionnaire onSubmit={…}>
 *     <QuestionnaireProgress />
 *     <Question name="…" required>
 *       <QuestionPrompt /> <QuestionDescription />
 *       <QuestionChoices>
 *         <QuestionChoice description="…" value="…">…</QuestionChoice>…
 *       </QuestionChoices>
 *       <QuestionError />
 *     </Question>
 *     <QuestionnaireActions>
 *       <QuestionnairePrevious /> <QuestionnaireSkip /> <QuestionnaireNext /> <QuestionnaireSubmit />
 *     </QuestionnaireActions>
 *   </Questionnaire>
 *
 * **The root owns the order, the active question, the answers and the navigation; the parent owns
 * dismissal, persistence and branching.** Which is why there is no `open`, no storage and no
 * `onDismiss` here: a questionnaire that decided when it appears could not be put in a dialog, a
 * sidebar and a page, and every product wants it in a different one.
 *
 * **No navigation state machine is written here.** Ark's `useSteps` already owns the step index,
 * `hasNextStep` / `hasPrevStep`, `percent`, and — the part that is easy to miss — the *guards*:
 * `isStepValid` blocks `STEP.NEXT` and fires `onStepInvalid`, and `isStepSkippable` overrides it.
 * A required question blocking Next and a skippable one not blocking are therefore two callbacks,
 * not two branches. None of Ark's Steps *parts* are used: `getContentProps` declares
 * `role="tabpanel"` and points `aria-labelledby` at a trigger, and this renders no tablist for
 * either to belong to.
 */

/** The answers, keyed by each question's `name`. */
export type QuestionnaireAnswers = Record<string, QuestionAnswer>;

/** The words the sequence writes, and its questions' — a question's own `translations` win. */
export interface QuestionnaireTranslations extends QuestionTranslations {
  /** The progress line and its `aria-valuetext`: *Question 2 of 4*. */
  progress: (position: number, count: number) => string;
  /** The actions row's accessible name. */
  navigation: string;
  previous: string;
  skip: string;
  next: string;
  submit: string;
}

const ENGLISH: Omit<QuestionnaireTranslations, keyof QuestionTranslations> = {
  progress: (position, count) => `Question ${position} of ${count}`,
  navigation: "Questionnaire navigation",
  previous: "Back",
  skip: "Skip",
  next: "Next",
  submit: "Submit",
};

interface QuestionnaireContextValue {
  answers: QuestionnaireAnswers;
  questions: QuestionnaireQuestion[];
  steps: UseStepsReturn;
  translations: Omit<QuestionnaireTranslations, keyof QuestionTranslations>;
}

const QuestionnaireContext = React.createContext<QuestionnaireContextValue | null>(null);

export function useQuestionnaire(): QuestionnaireContextValue {
  const context = React.useContext(QuestionnaireContext);
  if (!context) throw new Error("useQuestionnaire must be used inside <Questionnaire>");
  return context;
}

function questionsOf(children: React.ReactNode): QuestionnaireQuestion[] {
  return collect(children, Question).map((question) => {
    const props = question.props as QuestionProps;
    return {
      multiple: props.multiple === true,
      name: props.name,
      required: props.required === true,
      skippable: props.skippable === true,
    };
  });
}

/**
 * Whether a question lets navigation past it: unasked-for, or answered with a non-blank string or a
 * non-empty selection.
 */
function answered(question: QuestionnaireQuestion | undefined, answers: QuestionnaireAnswers): boolean {
  if (!question?.required) return true;
  const answer = answers[question.name];
  return Array.isArray(answer) ? answer.length > 0 : (answer ?? "").trim().length > 0;
}

export interface QuestionnaireProps
  extends Omit<React.ComponentProps<typeof ark.form>, "onSubmit"> {
  /** Answers to start from — a resumed session, or a question already decided elsewhere. */
  defaultAnswers?: QuestionnaireAnswers;
  /** Which question to open on. Persistence is the parent's, so resuming is this plus the answers. */
  defaultStep?: number;
  onAnswersChange?: (answers: QuestionnaireAnswers) => void;
  onStepChange?: (details: { step: number }) => void;
  /** Called with the whole payload when the last question is submitted and passes validation. */
  onSubmit?: (answers: QuestionnaireAnswers) => void;
  /**
   * Answer the visible question from the keyboard: `1`–`9`, by the choice's position, printed on a
   * `Kbd` beside it so the key is visible rather than folklore.
   *
   * **Opt-in — there is no default.** This registers a `window` keydown listener on bare, unmodified
   * keys, and a design system must not claim those in its host's keymap without being asked. Typing
   * in a text control is ignored; a focused radio or checkbox is not, which is the case that makes
   * the difference (both are `<input>` elements, and treating them as typing kills the shortcuts the
   * moment somebody clicks an option).
   */
  shortcuts?: boolean;
  /** The words of every part inside it, its questions' included; a question's own win for it. */
  translations?: Partial<QuestionnaireTranslations>;
}

export function Questionnaire(props: QuestionnaireProps) {
  const {
    children,
    className,
    defaultAnswers,
    defaultStep = 0,
    onAnswersChange,
    onStepChange,
    onSubmit,
    shortcuts = false,
    slot,
    translations,
    ...rest
  } = props;

  const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(defaultAnswers ?? {});
  const [blocked, setBlocked] = React.useState<number | null>(null);
  const questions = questionsOf(children);
  const indexOf = (name: string) => questions.findIndex((question) => question.name === name);

  const steps = useSteps({
    // `|| 1`: zag divides by `count` for `percent`, so an empty questionnaire would paint `NaN%`.
    count: questions.length || 1,
    defaultStep,
    isStepSkippable: (index) => questions[index]?.skippable === true,
    isStepValid: (index) => answered(questions[index], answers),
    onStepChange: (details) => {
      setBlocked(null);
      onStepChange?.(details);
    },
    onStepInvalid: (details) => setBlocked(details.step),
  });

  const setAnswer = (name: string, answer: QuestionAnswer) => {
    const next = { ...answers, [name]: answer };
    setBlocked(null);
    setAnswers(next);
    onAnswersChange?.(next);
  };

  // The machine has no "complete" event to send, so the last question's guard is spelled out —
  // from the machine's own two accessors, so the POLICY still lives in one place. Sending
  // `STEP.NEXT` instead would leave the form on a step past its last question with every question
  // hidden, which is a state a parent that keeps the form mounted has to undo.
  const submit = () => {
    const index = steps.value;
    if (!steps.isStepSkippable(index) && !steps.isStepValid(index)) {
      setBlocked(index);
      return;
    }
    onSubmit?.(answers);
  };

  const context: QuestionnaireContextValue = {
    answers,
    questions,
    steps,
    translations: { ...ENGLISH, ...translations },
  };

  return (
    <QuestionnaireContext.Provider value={context}>
      <QuestionSequenceContext.Provider
        value={{
          answers,
          blocked: (name) => blocked !== null && blocked === indexOf(name),
          current: (name) => indexOf(name) === steps.value,
          setAnswer,
          shortcuts,
          translations,
        }}
      >
        <ark.form
          className={cn("flex w-full min-w-0 flex-col gap-4", className)}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          {...rest}
          data-slot={slot ?? "questionnaire"}
        >
          {children}
        </ark.form>
      </QuestionSequenceContext.Provider>
    </QuestionnaireContext.Provider>
  );
}

/**
 * How far along we are, as a sentence rather than a bar: *Question 2 of 4*.
 *
 * **ARIA contract.** `role="progressbar"` with `aria-valuemin` / `aria-valuenow` / `aria-valuemax`
 * counting questions, not percent, and `aria-valuetext` carrying the same sentence the eye reads;
 * `aria-live="polite"` announces the move. `progressbar` is a leaf role with no keyboard contract,
 * so nothing is promised here that is not delivered.
 *
 * Ark's `Progress` is not used, and that is not an oversight: zag puts `role="progressbar"` on the
 * *track*, so a progress with no painted track has no role at all. The machine can only be kept by
 * painting the bar the reference does not have.
 *
 * The sentence is the root's `translations.progress`, a function of the two numbers, so the eye and
 * `aria-valuetext` read the same words in every language.
 */
export const QuestionnaireProgress = (props: Omit<React.ComponentProps<typeof ark.div>, "children">) => {
  const { className, slot, ...rest } = props;
  const { steps, translations } = useQuestionnaire();

  const position = steps.value + 1;
  const reading = translations.progress(position, steps.count);

  return (
    <ark.div
      aria-live="polite"
      aria-valuemax={steps.count}
      aria-valuemin={1}
      aria-valuenow={position}
      aria-valuetext={reading}
      // `min-w-[14ch]` and `min-h-[1lh]` reserve the line so the block below it does not shift as
      // the reading widens or while a translation is absent.
      className={cn(
        "min-h-[1lh] w-fit min-w-[14ch]",
        "font-medium text-muted-foreground text-xs tabular-nums",
        className,
      )}
      role="progressbar"
      {...rest}
      data-slot={slot ?? "questionnaire-progress"}
    >
      {reading}
    </ark.div>
  );
};

export interface QuestionnaireActionsProps
  extends Omit<React.ComponentProps<typeof ark.div>, "aria-label" | "aria-labelledby"> {
  /** Names the group, the way a run of independent controls needs naming; `translations.navigation` by default. */
  "aria-label"?: string;
}

/**
 * The navigation row: Back at the start, Skip and Next/Submit at the end.
 *
 * Three fixed columns rather than a `ButtonGroup`, and that is the point of it — `ButtonGroup`
 * collapses the inner radii and overlaps its children by a pixel, which is right for a cluster
 * acting on one thing and wrong for two ends of a journey. The columns hold their places while
 * Back and Skip come and go, so nothing slides sideways between questions.
 */
export const QuestionnaireActions = (props: QuestionnaireActionsProps) => {
  const { "aria-label": label, className, slot, ...rest } = props;
  const { translations } = useQuestionnaire();

  return (
    <ark.div
      aria-label={label ?? translations.navigation}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2",
        className,
      )}
      role="group"
      {...rest}
      data-slot={slot ?? "questionnaire-actions"}
    />
  );
};

/**
 * Drawn only where there is somewhere to go back to.
 *
 * Absent rather than disabled: the first question's row is one solid Next and nothing else, and a
 * greyed control that has never been available says nothing a reader can use.
 */
export const QuestionnairePrevious = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { steps, translations } = useQuestionnaire();

  if (!steps.hasPrevStep) return null;

  return (
    <Button
      className={cn("col-start-1 row-start-1 justify-self-start", className)}
      onClick={() => steps.goToPrevStep()}
      variant="outline"
      {...rest}
      slot={slot ?? "questionnaire-previous"}
    >
      {children ?? translations.previous}
    </Button>
  );
};

/** Drawn only where the visible question declared itself skippable — elsewhere it would lie. */
export const QuestionnaireSkip = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { questions, steps, translations } = useQuestionnaire();

  if (questions[steps.value]?.skippable !== true) return null;

  return (
    <Button
      className={cn("col-start-2 row-start-1 justify-self-end", className)}
      onClick={() => steps.goToNextStep()}
      variant="ghost"
      {...rest}
      slot={slot ?? "questionnaire-skip"}
    >
      {children ?? translations.skip}
    </Button>
  );
};

/**
 * Advance, or reveal why not.
 *
 * Never disabled on an unanswered question: a disabled control says nothing about what is missing,
 * and the machine's `onStepInvalid` is what puts the message on screen. It stands down on the last
 * question so that `QuestionnaireSubmit` can take the same place in the cluster.
 */
export const QuestionnaireNext = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { steps, translations } = useQuestionnaire();

  if (steps.value >= steps.count - 1) return null;

  return (
    <Button
      className={cn("col-start-3 row-start-1 justify-self-end", className)}
      onClick={() => steps.goToNextStep()}
      {...rest}
      slot={slot ?? "questionnaire-next"}
    >
      {children ?? translations.next}
    </Button>
  );
};

/** The other half of that pair: drawn only on the last question, and it submits the form. */
export const QuestionnaireSubmit = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { steps, translations } = useQuestionnaire();

  if (steps.value < steps.count - 1) return null;

  return (
    <Button
      className={cn("col-start-3 row-start-1 justify-self-end", className)}
      type="submit"
      {...rest}
      slot={slot ?? "questionnaire-submit"}
    >
      {children ?? translations.submit}
    </Button>
  );
};
