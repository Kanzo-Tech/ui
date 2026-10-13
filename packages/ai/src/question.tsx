import { ark } from "@ark-ui/react/factory";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import type React from "react";
import { buttonVariants, cn, RadioGroup } from "@kanzo-tech/ui";

/**
 * A question the model puts to the person, answered by picking one of its options — AI Elements'
 * `Question`, in its composition and its look: a bordered panel holding the prompt, a description,
 * and the options as a wrapping row of outline buttons, the chosen one filled.
 *
 * **Choosing is the answer, and that is AI Elements' own composition minus two parts.** Theirs ends in
 * `QuestionInput` (free text) and `QuestionSubmit`; every option already calls `onValueChange` as it
 * is picked, and a question composed without the last two is answered in one press. A host here takes
 * free text in the composer, where the person already types, so the two parts are not admitted; a
 * host that needs a confirming press is the evidence that would admit `QuestionSubmit`. Single
 * choice only: `selectionMode="multiple"` waits for a question that has more than one answer.
 *
 * **On Ark's radio group, not on buttons with `role="radio"`.** AI Elements gives each option
 * `role="radio"` and `aria-checked` and implements none of the radio group's keys, which is the
 * composite role without its keyboard contract the conventions forbid. Here the root is Ark's
 * `role="radiogroup"`, named by `QuestionPrompt` through `aria-labelledby`; arrow keys move between
 * the options and choose as they move, Tab enters and leaves the group. Each option is a `<label>`
 * around its hidden radio, painted with `Button`'s recipe, so it looks like their button and is a radio.
 */
export const Question = (props: React.ComponentProps<typeof RadioGroup>) => {
  const { className, slot, ...rest } = props;
  return (
    <RadioGroup
      className={cn("gap-4 rounded-box border bg-card p-4 text-card-foreground text-sm", className)}
      {...rest}
      slot={slot ?? "question"}
    />
  );
};

/** The question itself, and the group's accessible name. */
export const QuestionPrompt = (props: React.ComponentProps<typeof ArkRadioGroup.Label>) => {
  const { className, slot, ...rest } = props;
  return (
    <ArkRadioGroup.Label className={cn("font-medium text-sm", className)} {...rest} data-slot={slot ?? "question-prompt"} />
  );
};

/** Words under the prompt: why it is asked, what the answer changes. */
export const QuestionDescription = (props: React.ComponentProps<typeof ark.p>) => {
  const { className, slot, ...rest } = props;
  return (
    <ark.p className={cn("-mt-2 text-muted-foreground text-sm", className)} {...rest} data-slot={slot ?? "question-description"} />
  );
};

/** The options, as a row that wraps. */
export const QuestionOptions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;
  return <ark.div className={cn("flex flex-wrap gap-2", className)} {...rest} data-slot={slot ?? "question-options"} />;
};

/**
 * One option: an outline button at rest, `Button`'s default fill once chosen — set by moving the
 * recipe's own `--btn-*` locals rather than by painting over them, so the hover wash mixes from the
 * fill that is showing. It grows to hold a wrapped label, which a model's option often is.
 */
export const QuestionOption = (props: React.ComponentProps<typeof ArkRadioGroup.Item>) => {
  const { className, children, slot, ...rest } = props;
  return (
    <ArkRadioGroup.Item
      className={cn(
        buttonVariants({ variant: "outline", clickEffect: false }),
        "h-auto min-h-(--size) cursor-pointer whitespace-normal py-1.5 text-start",
        "data-[state=checked]:[--btn-bd:transparent] data-[state=checked]:[--btn-bg:var(--primary)] data-[state=checked]:[--btn-fg:var(--primary-foreground)]",
        "data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring",
        className,
      )}
      {...rest}
      data-slot={slot ?? "question-option"}
    >
      <ArkRadioGroup.ItemText>{children}</ArkRadioGroup.ItemText>
      <ArkRadioGroup.ItemHiddenInput />
    </ArkRadioGroup.Item>
  );
};
