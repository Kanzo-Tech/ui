"use client";

import { ark } from "@ark-ui/react/factory";
import { useFieldsetContext, type UseFieldsetContext } from "@ark-ui/react/fieldset";
import { useSteps, type UseStepsReturn } from "@ark-ui/react/steps";
import * as React from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Button, type ButtonProps } from "../simples/button.js";
import { Checkbox, CheckboxGroup } from "../simples/checkbox.js";
import {
  FieldLegend,
  FieldSet,
  FieldSetError,
  FieldSetHelper,
  FieldTitle,
} from "../simples/field.js";
import { Input } from "../simples/input.js";
import { ItemContent, ItemDescription } from "../simples/item.js";
import { Kbd } from "../simples/kbd.js";
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupText,
} from "../simples/radio-group.js";
import { Textarea } from "../simples/textarea.js";

/**
 * Questionnaire — one question at a time, with progress, validation and navigation.
 *
 *   <Questionnaire onSubmit={…}>
 *     <QuestionnaireProgress />
 *     <QuestionnaireItem name="…" required>
 *       <QuestionnaireTitle /> <QuestionnaireDescription />
 *       <QuestionnaireChoices>
 *         <QuestionnaireChoice description="…" value="…">…</QuestionnaireChoice>…
 *       </QuestionnaireChoices>
 *       <QuestionnaireError />
 *     </QuestionnaireItem>
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
 *
 * **A question is a `FieldSet`.** That is what carries the ARIA rather than anything hand-rolled:
 * Ark's fieldset names the group from its own legend, describes it from the helper and error text,
 * and marks the error `aria-live="polite"` — so `QuestionnaireError` announces itself on the group
 * that failed with no `role="alert"` of ours anywhere.
 */

export type QuestionnaireAnswer = string | string[];
export type QuestionnaireAnswers = Record<string, QuestionnaireAnswer>;

/** What the root reads off an item's own props to steer the machine. */
export interface QuestionnaireQuestion {
  multiple: boolean;
  name: string;
  required: boolean;
  skippable: boolean;
}

interface QuestionnaireContextValue {
  answers: QuestionnaireAnswers;
  /** The index whose Next was refused, or `null`. One at a time: only one question is on screen. */
  blocked: number | null;
  indexOf: (name: string) => number;
  questions: QuestionnaireQuestion[];
  setAnswer: (name: string, answer: QuestionnaireAnswer) => void;
  shortcuts: boolean;
  steps: UseStepsReturn;
}

interface QuestionnaireItemContextValue {
  current: boolean;
  index: number;
  /** This item's own declaration — what a part of the caller's can read without the scan. */
  question: QuestionnaireQuestion;
  /** The key printed on a choice's `Kbd`, or `undefined` when shortcuts are off. */
  shortcutOf: (value: string) => string | undefined;
}

const QuestionnaireContext = React.createContext<QuestionnaireContextValue | null>(null);
const QuestionnaireItemContext = React.createContext<QuestionnaireItemContextValue | null>(null);

export function useQuestionnaire(): QuestionnaireContextValue {
  const context = React.useContext(QuestionnaireContext);
  if (!context) throw new Error("useQuestionnaire must be used inside <Questionnaire>");
  return context;
}

export function useQuestionnaireItem(): QuestionnaireItemContextValue {
  const context = React.useContext(QuestionnaireItemContext);
  if (!context) throw new Error("This part must be used inside <QuestionnaireItem>");
  return context;
}

/**
 * Every descendant of `node` rendered as `type`, in source order.
 *
 * The root needs the ordered questions and an item needs its ordered choices *before* either
 * renders — the machine is constructed with a `count` and a validity callback keyed by index, and a
 * registration effect would hand it a count of zero on the first pass (`percent` is `step / count`,
 * so that is `NaN` on screen). Reading the elements is synchronous and cannot disagree with what is
 * rendered a moment later.
 *
 * It descends through arrays, fragments and any element's children, which covers a list built with
 * `.map()` and a question wrapped in a `<div>`. What it cannot see through is a *component* of the
 * caller's that returns items, because its children do not exist until it renders.
 */
function collect(node: React.ReactNode, type: React.ElementType): React.ReactElement[] {
  const found: React.ReactElement[] = [];
  const walk = (current: React.ReactNode) => {
    React.Children.forEach(current, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === type) {
        found.push(child);
        return;
      }
      walk((child.props as { children?: React.ReactNode }).children);
    });
  };
  walk(node);
  return found;
}

function questionsOf(children: React.ReactNode): QuestionnaireQuestion[] {
  return collect(children, QuestionnaireItem).map((item) => {
    const props = item.props as QuestionnaireItemProps;
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
    ...rest
  } = props;

  const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(defaultAnswers ?? {});
  const [blocked, setBlocked] = React.useState<number | null>(null);
  const questions = questionsOf(children);

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

  const setAnswer = (name: string, answer: QuestionnaireAnswer) => {
    const next = { ...answers, [name]: answer };
    setBlocked(null);
    setAnswers(next);
    onAnswersChange?.(next);
  };

  // The machine has no "complete" event to send, so the last question's guard is spelled out —
  // from the machine's own two accessors, so the POLICY still lives in one place. Sending
  // `STEP.NEXT` instead would leave the form on a step past its last question with every item
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
    blocked,
    indexOf: (name) => questions.findIndex((question) => question.name === name),
    questions,
    setAnswer,
    shortcuts,
    steps,
  };

  return (
    <QuestionnaireContext.Provider value={context}>
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
 * Children override the sentence, which is how it is translated — `useQuestionnaire()` carries the
 * numbers.
 */
export const QuestionnaireProgress = (props: React.ComponentProps<typeof ark.div>) => {
  const { children, className, slot, ...rest } = props;
  const { steps } = useQuestionnaire();

  const position = steps.value + 1;
  const reading = `Question ${position} of ${steps.count}`;

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
      {children ?? reading}
    </ark.div>
  );
};

export interface QuestionnaireItemProps extends React.ComponentProps<typeof FieldSet> {
  /** Accumulate several answers instead of one — a `CheckboxGroup` rather than a `RadioGroup`. */
  multiple?: boolean;
  /** The key this question's answer is filed under. Unique within the questionnaire. */
  name: string;
  /** Refuse Next until it is answered. */
  required?: boolean;
  /** Offer a Skip, and let Next through unanswered. Overrides `required`, the way Ark's guard does. */
  skippable?: boolean;
}

export function QuestionnaireItem(props: QuestionnaireItemProps) {
  const { children, className, multiple, name, required, skippable, slot, ...rest } = props;
  const { answers, blocked, indexOf, setAnswer, shortcuts, steps } = useQuestionnaire();

  const index = indexOf(name);
  const current = index === steps.value;
  const question: QuestionnaireQuestion = {
    multiple: multiple === true,
    name,
    required: required === true,
    skippable: skippable === true,
  };
  const values = choiceValues(children);

  // No dependency array on purpose: the handler reads the answers and the choice list of THIS
  // render, and a listener held across an answer would toggle against a stale array. One
  // add/remove per render is cheaper than the ref dance that would avoid it.
  React.useEffect(() => {
    if (!current || !shortcuts || values.length === 0) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      // A radio and a checkbox are `<input>` too, and Ark keeps focus on the hidden one — so
      // "focus is in an input" would switch the shortcuts off as soon as a choice was clicked.
      const typing =
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active.tagName === "TEXTAREA" ||
          (active instanceof HTMLInputElement &&
            active.type !== "checkbox" &&
            active.type !== "radio"));
      if (typing) return;

      const hit = values[Number(event.key) - 1];
      if (hit === undefined) return;
      event.preventDefault();

      if (!question.multiple) {
        setAnswer(name, hit);
        return;
      }
      const chosen = answers[name];
      const list = Array.isArray(chosen) ? chosen : [];
      setAnswer(
        name,
        list.includes(hit) ? list.filter((value) => value !== hit) : [...list, hit],
      );
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const item: QuestionnaireItemContextValue = {
    current,
    index,
    question,
    shortcutOf: (value) => {
      const position = values.indexOf(value);
      // Only the first nine: `10` is two keystrokes and there is no chord worth inventing for a
      // tenth option — a question with that many is a `Select`, not a questionnaire.
      return shortcuts && position >= 0 && position < 9 ? String(position + 1) : undefined;
    },
  };

  return (
    <QuestionnaireItemContext.Provider value={item}>
      <FieldSet
        aria-current={current ? "step" : undefined}
        className={cn("min-w-0 gap-4", className)}
        hidden={!current}
        invalid={blocked === index}
        {...rest}
        slot={slot ?? "questionnaire-item"}
      >
        {children}
      </FieldSet>
    </QuestionnaireItemContext.Provider>
  );
}

/** One item's choices in source order — which is also the order the shortcut keys are handed out. */
function choiceValues(children: React.ReactNode): string[] {
  return collect(children, QuestionnaireChoice).map(
    (choice) => (choice.props as QuestionnaireChoiceProps).value,
  );
}

/**
 * The question itself. A `<legend>`, which is what names the group Ark builds around it.
 *
 * The margin is not the fieldset's `gap`: a `<legend>` is rendered into the fieldset's border and
 * is not a flex item, so `gap` never reaches it. It sits flush against its own description and
 * opens up to `mb-4` when there is none — delete either half and the two spellings of this
 * question's heading stop agreeing.
 */
export const QuestionnaireTitle = (props: React.ComponentProps<typeof FieldLegend>) => {
  const { className, slot, ...rest } = props;

  return (
    <FieldLegend
      className={cn(
        "mb-0 font-heading text-pretty leading-snug",
        "[&:not(:has(~[data-slot=questionnaire-description]))]:mb-4",
        className,
      )}
      {...rest}
      slot={slot ?? "questionnaire-title"}
    />
  );
};

export const QuestionnaireDescription = (props: React.ComponentProps<typeof FieldSetHelper>) => {
  const { className, slot, ...rest } = props;

  return (
    <FieldSetHelper
      className={cn("text-pretty", className)}
      {...rest}
      slot={slot ?? "questionnaire-description"}
    />
  );
};

/**
 * Why Next was refused. Renders only while the fieldset is invalid, which is Ark's rule and not
 * ours — and Ark gives it `aria-live="polite"` and hangs it off the group's `aria-describedby`.
 */
export const QuestionnaireError = (props: React.ComponentProps<typeof FieldSetError>) => {
  const { children, slot, ...rest } = props;

  return (
    <FieldSetError {...rest} slot={slot ?? "questionnaire-error"}>
      {children ?? "Answer this to continue."}
    </FieldSetError>
  );
};

/**
 * The item's options — a radio group, or a checkbox group where the item is `multiple`.
 *
 * One component and not two, because the choice between them is the item's own `multiple` and a
 * caller who had to pick would be stating it twice.
 */
export type QuestionnaireChoicesProps = Omit<
  React.ComponentProps<typeof ark.div>,
  "defaultValue" | "value"
>;

export const QuestionnaireChoices = (props: QuestionnaireChoicesProps) => {
  const { children, className, slot, ...rest } = props;
  const { answers, setAnswer } = useQuestionnaire();
  const { question } = useQuestionnaireItem();
  const { multiple, name } = question;
  const answer = answers[name];

  if (multiple) {
    return (
      <CheckboxGroup
        className={cn("gap-2", className)}
        onValueChange={(value) => setAnswer(name, value)}
        value={Array.isArray(answer) ? answer : []}
        {...rest}
        slot={slot ?? "questionnaire-choices"}
      >
        {children}
      </CheckboxGroup>
    );
  }

  return (
    <RadioGroup
      className={cn("gap-2", className)}
      onValueChange={(details) => setAnswer(name, details.value ?? "")}
      value={typeof answer === "string" ? answer : null}
      {...rest}
      slot={slot ?? "questionnaire-choices"}
    >
      {children}
    </RadioGroup>
  );
};

/**
 * The card a choice is drawn as, in one recipe for both arms.
 *
 * `shell` is the border-and-state half. `RadioGroupCard` already *is* that shell, so the single
 * arm inherits it and only the multiple arm asks for it — a `Checkbox` has no card of its own. The
 * values are `simples/radio-group.tsx`'s, which is where the ΔE figures behind the hover and
 * selected fills are recorded and dated; they are restated here and decided there.
 *
 * **The control sits at the end**, which is where the reference puts it: a choice card is read as a
 * sentence and answered at the margin, and a control at the start makes a column of radios with
 * text hanging off them. `Checkbox` renders its control before its children and has to, so the
 * multiple arm reorders in CSS; the single arm simply writes the indicator last.
 *
 * `min-h-[44px]` is in pixels, not `rem`: WCAG 2.5.8 states its bar in CSS pixels, and every `rem`
 * here resolves against a root the density axis sets (14px at compact), so a `rem` floor is the
 * failure dressed as the fix.
 */
const questionnaireChoiceVariants = tv({
  base: [
    "group/questionnaire-choice",
    "relative flex w-full min-h-[44px] items-start gap-3",
    "cursor-pointer select-none rounded-lg px-3.5 py-3",
    "text-start text-sm",
    "transition-colors",
    // The control is 16px against a 20px title line, so it drops 2px to sit on that line rather
    // than on the top of a two-line stack.
    "*:data-[slot=checkbox-control]:mt-0.5 *:data-[slot=radio-group-indicator]:mt-0.5",
  ],
  variants: {
    shell: {
      true: [
        "border border-input bg-transparent",
        "hover:bg-foreground/14",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/17",
        "data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring",
        "data-invalid:border-destructive",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        // See the docblock: the control is the last thing in the row, and `Checkbox` renders it
        // first.
        "*:data-[slot=checkbox-control]:order-last",
      ],
    },
  },
  defaultVariants: {
    shell: false,
  },
});

// `ark.label`, not `ark.div`: both arms render the control's own `<label>` as the card, so that is
// the element a caller's props and `ref` land on.
export interface QuestionnaireChoiceProps
  extends Omit<React.ComponentProps<typeof ark.label>, "value"> {
  /**
   * The muted second line — what the option means, rather than what it is called.
   *
   * A `string` and not a node, following `CardHeader`'s `title` / `description`: the label is
   * already this part's children, and the control has to *name* itself off an element this
   * component renders, so a second children slot would have to be found by splitting them.
   */
  description?: string;
  /** What this choice contributes to the answer. */
  value: string;
}

/**
 * One option, drawn as a card: the label and its description, then the shortcut key as a chip,
 * then the control at the margin.
 *
 * The card is the control's own `<label>` in both arms, so the whole of it is the target. What
 * differs is where the accessible name is read from: Ark points a radio's hidden input at its
 * `ItemText`, and a checkbox's at the label part we do not render — so the multiple arm names
 * itself explicitly off the title instead.
 *
 * `Item` is not the card here, deliberately. It declares `role="listitem"`, which inside a
 * `radiogroup` is a list item with no list, and `asChild`-ing it onto the control would put that
 * role on the control itself — the failure `Item`'s own docblock describes.
 */
export const QuestionnaireChoice = (props: QuestionnaireChoiceProps) => {
  const { children, className, description, slot, value, ...rest } = props;
  const { question, shortcutOf } = useQuestionnaireItem();
  const key = shortcutOf(value);
  const labelId = React.useId();

  const body = (
    <>
      <ItemContent slot="questionnaire-choice-label">
        {question.multiple ? (
          <FieldTitle id={labelId} slot="questionnaire-choice-title">
            {children}
          </FieldTitle>
        ) : (
          <RadioGroupText slot="questionnaire-choice-title">{children}</RadioGroupText>
        )}

        {description ? (
          <ItemDescription slot="questionnaire-choice-description">{description}</ItemDescription>
        ) : null}
      </ItemContent>

      {/* No fill of its own. It used to paint `bg-background`, which is a second opinion about
          what is behind the card — on a selected one it punched a page-coloured hole through the
          tint. Transparent, it takes whatever the card is showing. */}
      {key ? (
        <Kbd
          aria-hidden
          className="mt-0.5 size-5 shrink-0 rounded-md bg-transparent text-muted-foreground"
          variant="outline"
        >
          {key}
        </Kbd>
      ) : null}
    </>
  );

  if (question.multiple) {
    return (
      <Checkbox
        aria-labelledby={labelId}
        className={cn(questionnaireChoiceVariants({ shell: true }), className)}
        value={value}
        {...rest}
        slot={slot ?? "questionnaire-choice"}
      >
        {body}
      </Checkbox>
    );
  }

  return (
    <RadioGroupCard
      className={cn(questionnaireChoiceVariants(), className)}
      value={value}
      {...rest}
      slot={slot ?? "questionnaire-choice"}
    >
      {body}
      <RadioGroupIndicator />
    </RadioGroupCard>
  );
};

/**
 * A freeform answer following a list of choices is the last row of that list, not a field below it
 * — so it closes the item's `gap-4` back down to the `gap-2` between the cards.
 */
const freeform = "[[data-slot=questionnaire-choices]+&]:-mt-2";

/**
 * The freeform arm — a single-line answer filed under the item's name.
 *
 * A fieldset's legend names the GROUP, not a control inside it, so the input is pointed at the
 * legend explicitly. Without this the question is announced when focus enters the group and the
 * control itself is unnamed.
 */
export const QuestionnaireInput = (props: React.ComponentProps<typeof Input>) => {
  const { className, slot, ...rest } = props;
  const { answers, setAnswer } = useQuestionnaire();
  const { question } = useQuestionnaireItem();
  const fieldset: UseFieldsetContext | undefined = useFieldsetContext();
  const answer = answers[question.name];

  return (
    <Input
      aria-labelledby={fieldset?.ids.legend}
      className={cn(freeform, className)}
      onChange={(event) => setAnswer(question.name, event.target.value)}
      value={typeof answer === "string" ? answer : ""}
      {...rest}
      slot={slot ?? "questionnaire-input"}
    />
  );
};

/** The same binding over a `Textarea`, for the answer that runs to a paragraph. */
export const QuestionnaireTextarea = (props: React.ComponentProps<typeof Textarea>) => {
  const { className, slot, ...rest } = props;
  const { answers, setAnswer } = useQuestionnaire();
  const { question } = useQuestionnaireItem();
  const fieldset: UseFieldsetContext | undefined = useFieldsetContext();
  const answer = answers[question.name];

  return (
    <Textarea
      aria-labelledby={fieldset?.ids.legend}
      className={cn(freeform, className)}
      onChange={(event) => setAnswer(question.name, event.target.value)}
      value={typeof answer === "string" ? answer : ""}
      {...rest}
      slot={slot ?? "questionnaire-textarea"}
    />
  );
};

export interface QuestionnaireActionsProps
  extends Omit<React.ComponentProps<typeof ark.div>, "aria-label" | "aria-labelledby"> {
  /** Names the group, the way a run of independent controls needs naming. */
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
  const { "aria-label": label = "Questionnaire navigation", className, slot, ...rest } = props;

  return (
    <ark.div
      aria-label={label}
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
  const { steps } = useQuestionnaire();

  if (!steps.hasPrevStep) return null;

  return (
    <Button
      className={cn("col-start-1 row-start-1 justify-self-start", className)}
      onClick={() => steps.goToPrevStep()}
      variant="outline"
      {...rest}
      slot={slot ?? "questionnaire-previous"}
    >
      {children ?? "Back"}
    </Button>
  );
};

/** Drawn only where the visible question declared itself skippable — elsewhere it would lie. */
export const QuestionnaireSkip = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { questions, steps } = useQuestionnaire();

  if (questions[steps.value]?.skippable !== true) return null;

  return (
    <Button
      className={cn("col-start-2 row-start-1 justify-self-end", className)}
      onClick={() => steps.goToNextStep()}
      variant="ghost"
      {...rest}
      slot={slot ?? "questionnaire-skip"}
    >
      {children ?? "Skip"}
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
  const { steps } = useQuestionnaire();

  if (steps.value >= steps.count - 1) return null;

  return (
    <Button
      className={cn("col-start-3 row-start-1 justify-self-end", className)}
      onClick={() => steps.goToNextStep()}
      {...rest}
      slot={slot ?? "questionnaire-next"}
    >
      {children ?? "Next"}
    </Button>
  );
};

/** The other half of that pair: drawn only on the last question, and it submits the form. */
export const QuestionnaireSubmit = (props: ButtonProps) => {
  const { children, className, slot, ...rest } = props;
  const { steps } = useQuestionnaire();

  if (steps.value < steps.count - 1) return null;

  return (
    <Button
      className={cn("col-start-3 row-start-1 justify-self-end", className)}
      type="submit"
      {...rest}
      slot={slot ?? "questionnaire-submit"}
    >
      {children ?? "Submit"}
    </Button>
  );
};
