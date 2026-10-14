"use client";

import { ark } from "@ark-ui/react/factory";
import { useFieldsetContext, type UseFieldsetContext } from "@ark-ui/react/fieldset";
import * as React from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
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
 * Question — a question put to the person, answered by picking, or by typing where it asks for an
 * input. One part wherever a question is asked: on its own — a decision in a guided chat, one per
 * turn — and inside a `Questionnaire`, which is the sequence and the navigation around several.
 *
 *   <Question name="…" required onValueChange={…}>
 *     <QuestionPrompt /> <QuestionDescription />
 *     <QuestionChoices>
 *       <QuestionChoice description="…" value="…">…</QuestionChoice>…
 *     </QuestionChoices>
 *     <QuestionError />
 *   </Question>
 *
 * **A question is a `FieldSet`.** That is what carries the ARIA rather than anything hand-rolled:
 * Ark's fieldset names the group from its own legend, describes it from the helper and error text,
 * and marks the error `aria-live="polite"` — so `QuestionError` announces itself on the group that
 * failed with no `role="alert"` of ours anywhere.
 *
 * **The answer is the question's on its own and the questionnaire's inside one.** Alone it is
 * `value` / `defaultValue` / `onValueChange`, the way every Ark control holds its value, and a pick
 * is the answer in one press: a radio reports itself as it is chosen. Inside a `Questionnaire` the
 * answer is filed under `name` in the questionnaire's answers, which is where a resumed session
 * hands it back (`defaultAnswers`), so `value` and `defaultValue` are not read there;
 * `onValueChange` still is.
 *
 * It knows no model. A model's decision is data — a question and its options — and drawing it is a
 * form, which is why the part is here and not in `@kanzo-tech/ai` (`/docs/design/admission`).
 */

/** One question's answer: a string for a single choice or a freeform answer, a list for `multiple`. */
export type QuestionAnswer = string | string[];

/** The words a question writes. */
export interface QuestionTranslations {
  /** `QuestionError`'s sentence, when it is given none of its own. */
  unanswered: string;
}

const ENGLISH: QuestionTranslations = {
  unanswered: "Answer this to continue.",
};

/** What a `Questionnaire` reads off a question's own props to steer its machine. */
export interface QuestionnaireQuestion {
  multiple: boolean;
  name: string;
  required: boolean;
  skippable: boolean;
}

/**
 * What a sequence around a question hands it: where its answer is kept, whether it is the one on
 * screen, and whether Next was refused on it. `Questionnaire` provides it; it is not a door of its
 * own, so it leaves this module only for `Questionnaire.tsx`.
 */
export interface QuestionSequence {
  answers: Record<string, QuestionAnswer>;
  blocked: (name: string) => boolean;
  current: (name: string) => boolean;
  setAnswer: (name: string, answer: QuestionAnswer) => void;
  shortcuts: boolean;
  translations: Partial<QuestionTranslations> | undefined;
}

export const QuestionSequenceContext = React.createContext<QuestionSequence | null>(null);

interface QuestionContextValue {
  /** Undefined while unanswered. */
  answer: QuestionAnswer | undefined;
  /** Whether this question is the one on screen: always, on its own. */
  current: boolean;
  /** This question's own declaration — what a part of the caller's can read without the scan. */
  question: QuestionnaireQuestion;
  setAnswer: (answer: QuestionAnswer) => void;
  /** The key printed on a choice's `Kbd`, or `undefined` when shortcuts are off. */
  shortcutOf: (value: string) => string | undefined;
  translations: QuestionTranslations;
}

const QuestionContext = React.createContext<QuestionContextValue | null>(null);

export function useQuestion(): QuestionContextValue {
  const context = React.useContext(QuestionContext);
  if (!context) throw new Error("This part must be used inside <Question>");
  return context;
}

/**
 * Every descendant of `node` rendered as `type`, in source order.
 *
 * A questionnaire needs its ordered questions and a question its ordered choices *before* either
 * renders — the steps machine is constructed with a `count` and a validity callback keyed by index,
 * and a registration effect would hand it a count of zero on the first pass (`percent` is
 * `step / count`, so that is `NaN` on screen). Reading the elements is synchronous and cannot
 * disagree with what is rendered a moment later.
 *
 * It descends through arrays, fragments and any element's children, which covers a list built with
 * `.map()` and a question wrapped in a `<div>`. What it cannot see through is a *component* of the
 * caller's that returns questions, because its children do not exist until it renders.
 */
export function collect(node: React.ReactNode, type: React.ElementType): React.ReactElement[] {
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

export interface QuestionProps
  extends Omit<React.ComponentProps<typeof FieldSet>, "defaultValue" | "onChange"> {
  /** The answer to start from, on its own. Inside a `Questionnaire`, its `defaultAnswers`. */
  defaultValue?: QuestionAnswer;
  /** Accumulate several answers instead of one — a `CheckboxGroup` rather than a `RadioGroup`. */
  multiple?: boolean;
  /**
   * The key the answer is filed under: the form field's name, and inside a `Questionnaire` its key
   * in the answers. Unique within the questionnaire.
   */
  name: string;
  /** Called with the answer as it is made — a pick, a keystroke. */
  onValueChange?: (details: { value: QuestionAnswer }) => void;
  /** Inside a `Questionnaire`, refuse Next until it is answered. */
  required?: boolean;
  /**
   * Inside a `Questionnaire`, offer a Skip, and let Next through unanswered. Overrides `required`,
   * the way Ark's guard does.
   */
  skippable?: boolean;
  /** Its words; a `Questionnaire`'s `translations` reach it too, and these win. */
  translations?: Partial<QuestionTranslations>;
  /** The answer, controlled, on its own; `null` is controlled and unanswered. */
  value?: QuestionAnswer | null;
}

export function Question(props: QuestionProps) {
  const {
    children,
    className,
    defaultValue,
    invalid,
    multiple,
    name,
    onValueChange,
    required,
    skippable,
    slot,
    translations,
    value,
    ...rest
  } = props;
  const sequence = React.useContext(QuestionSequenceContext);
  const [own, setOwn] = React.useState<QuestionAnswer | undefined>(defaultValue);

  const answer = sequence ? sequence.answers[name] : value === undefined ? own : (value ?? undefined);
  const current = sequence ? sequence.current(name) : true;
  const shortcuts = sequence?.shortcuts === true;
  const question: QuestionnaireQuestion = {
    multiple: multiple === true,
    name,
    required: required === true,
    skippable: skippable === true,
  };
  const values = choiceValues(children);

  const setAnswer = (next: QuestionAnswer) => {
    if (sequence) sequence.setAnswer(name, next);
    else if (value === undefined) setOwn(next);
    onValueChange?.({ value: next });
  };

  // No dependency array on purpose: the handler reads the answer and the choice list of THIS
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
        setAnswer(hit);
        return;
      }
      const list = Array.isArray(answer) ? answer : [];
      setAnswer(list.includes(hit) ? list.filter((chosen) => chosen !== hit) : [...list, hit]);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const context: QuestionContextValue = {
    answer,
    current,
    question,
    setAnswer,
    shortcutOf: (choice) => {
      const position = values.indexOf(choice);
      // Only the first nine: `10` is two keystrokes and there is no chord worth inventing for a
      // tenth option — a question with that many is a `Select`, not a questionnaire.
      return shortcuts && position >= 0 && position < 9 ? String(position + 1) : undefined;
    },
    translations: { ...ENGLISH, ...sequence?.translations, ...translations },
  };

  return (
    <QuestionContext.Provider value={context}>
      <FieldSet
        aria-current={sequence && current ? "step" : undefined}
        className={cn("min-w-0 gap-4", className)}
        hidden={!current}
        invalid={invalid === true || sequence?.blocked(name) === true}
        {...rest}
        slot={slot ?? "question"}
      >
        {children}
      </FieldSet>
    </QuestionContext.Provider>
  );
}

/** One question's choices in source order — which is also the order the shortcut keys are handed out. */
function choiceValues(children: React.ReactNode): string[] {
  return collect(children, QuestionChoice).map((choice) => (choice.props as QuestionChoiceProps).value);
}

/**
 * The question itself. A `<legend>`, which is what names the group Ark builds around it.
 *
 * The margin is not the fieldset's `gap`: a `<legend>` is rendered into the fieldset's border and
 * is not a flex item, so `gap` never reaches it. It sits flush against its own description and
 * opens up to `mb-4` when there is none — delete either half and the two spellings of this
 * question's heading stop agreeing.
 */
export const QuestionPrompt = (props: React.ComponentProps<typeof FieldLegend>) => {
  const { className, slot, ...rest } = props;

  return (
    <FieldLegend
      className={cn(
        "mb-0 font-heading text-pretty leading-snug",
        "[&:not(:has(~[data-slot=question-description]))]:mb-4",
        className,
      )}
      {...rest}
      slot={slot ?? "question-prompt"}
    />
  );
};

/** Words under the prompt: why it is asked, what the answer changes. */
export const QuestionDescription = (props: React.ComponentProps<typeof FieldSetHelper>) => {
  const { className, slot, ...rest } = props;

  return (
    <FieldSetHelper className={cn("text-pretty", className)} {...rest} slot={slot ?? "question-description"} />
  );
};

/**
 * Why the question is not answered yet. Renders only while the fieldset is invalid, which is Ark's
 * rule and not ours — and Ark gives it `aria-live="polite"` and hangs it off the group's
 * `aria-describedby`. Inside a `Questionnaire`, a refused Next is what makes it invalid; on its own,
 * the question's `invalid`.
 */
export const QuestionError = (props: React.ComponentProps<typeof FieldSetError>) => {
  const { children, slot, ...rest } = props;
  const { translations } = useQuestion();

  return (
    <FieldSetError {...rest} slot={slot ?? "question-error"}>
      {children ?? translations.unanswered}
    </FieldSetError>
  );
};

/**
 * The question's options — a radio group, or a checkbox group where the question is `multiple`.
 *
 * One component and not two, because the choice between them is the question's own `multiple` and
 * a caller who had to pick would be stating it twice.
 */
export type QuestionChoicesProps = Omit<React.ComponentProps<typeof ark.div>, "defaultValue" | "value">;

export const QuestionChoices = (props: QuestionChoicesProps) => {
  const { children, className, slot, ...rest } = props;
  const { answer, question, setAnswer } = useQuestion();
  const { multiple, name } = question;

  if (multiple) {
    return (
      <CheckboxGroup
        className={cn("gap-2", className)}
        name={name}
        onValueChange={(value) => setAnswer(value)}
        value={Array.isArray(answer) ? answer : []}
        {...rest}
        slot={slot ?? "question-choices"}
      >
        {children}
      </CheckboxGroup>
    );
  }

  return (
    <RadioGroup
      className={cn("gap-2", className)}
      name={name}
      onValueChange={(details) => setAnswer(details.value ?? "")}
      value={typeof answer === "string" ? answer : null}
      {...rest}
      slot={slot ?? "question-choices"}
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
const questionChoiceVariants = tv({
  base: [
    "group/question-choice",
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
export interface QuestionChoiceProps extends Omit<React.ComponentProps<typeof ark.label>, "value"> {
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
export const QuestionChoice = (props: QuestionChoiceProps) => {
  const { children, className, description, slot, value, ...rest } = props;
  const { question, shortcutOf } = useQuestion();
  const key = shortcutOf(value);
  const labelId = React.useId();

  const body = (
    <>
      <ItemContent slot="question-choice-label">
        {question.multiple ? (
          <FieldTitle id={labelId} slot="question-choice-title">
            {children}
          </FieldTitle>
        ) : (
          <RadioGroupText slot="question-choice-title">{children}</RadioGroupText>
        )}

        {description ? <ItemDescription slot="question-choice-description">{description}</ItemDescription> : null}
      </ItemContent>

      {/* No fill of its own. It used to paint `bg-background`, which is a second opinion about
          what is behind the card — on a selected one it punched a page-coloured hole through the
          tint. Transparent, it takes whatever the card is showing. */}
      {key ? (
        <Kbd aria-hidden className="mt-0.5 size-5 shrink-0 rounded-md bg-transparent text-muted-foreground" variant="outline">
          {key}
        </Kbd>
      ) : null}
    </>
  );

  if (question.multiple) {
    return (
      <Checkbox
        aria-labelledby={labelId}
        className={cn(questionChoiceVariants({ shell: true }), className)}
        value={value}
        {...rest}
        slot={slot ?? "question-choice"}
      >
        {body}
      </Checkbox>
    );
  }

  return (
    <RadioGroupCard className={cn(questionChoiceVariants(), className)} value={value} {...rest} slot={slot ?? "question-choice"}>
      {body}
      <RadioGroupIndicator />
    </RadioGroupCard>
  );
};

/**
 * A freeform answer following a list of choices is the last row of that list, not a field below it
 * — so it closes the question's `gap-4` back down to the `gap-2` between the cards.
 */
const freeform = "[[data-slot=question-choices]+&]:-mt-2";

/**
 * The freeform arm — a single-line answer filed under the question's name.
 *
 * A fieldset's legend names the GROUP, not a control inside it, so the input is pointed at the
 * legend explicitly. Without this the question is announced when focus enters the group and the
 * control itself is unnamed.
 */
export const QuestionInput = (props: React.ComponentProps<typeof Input>) => {
  const { className, slot, ...rest } = props;
  const { answer, question, setAnswer } = useQuestion();
  const fieldset: UseFieldsetContext | undefined = useFieldsetContext();

  return (
    <Input
      aria-labelledby={fieldset?.ids.legend}
      className={cn(freeform, className)}
      name={question.name}
      onChange={(event) => setAnswer(event.target.value)}
      value={typeof answer === "string" ? answer : ""}
      {...rest}
      slot={slot ?? "question-input"}
    />
  );
};

/** The same binding over a `Textarea`, for the answer that runs to a paragraph. */
export const QuestionTextarea = (props: React.ComponentProps<typeof Textarea>) => {
  const { className, slot, ...rest } = props;
  const { answer, question, setAnswer } = useQuestion();
  const fieldset: UseFieldsetContext | undefined = useFieldsetContext();

  return (
    <Textarea
      aria-labelledby={fieldset?.ids.legend}
      className={cn(freeform, className)}
      name={question.name}
      onChange={(event) => setAnswer(event.target.value)}
      value={typeof answer === "string" ? answer : ""}
      {...rest}
      slot={slot ?? "question-textarea"}
    />
  );
};
