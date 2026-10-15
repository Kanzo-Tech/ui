import { ark } from "@ark-ui/react/factory";
import { CircleCheckIcon, CircleDashedIcon, CircleIcon } from "lucide-react";
import type React from "react";
import { cn, Spinner } from "@kanzo-tech/ui";

/**
 * Where a step stands. AI Elements' three — `complete`, `active`, `pending` — and one more of ours,
 * `waiting`: the step is the person's to take, and the work stops there until they do.
 */
export type ChainOfThoughtStatus = "complete" | "active" | "waiting" | "pending";

/** Every word a step says to assistive tech, since its icon is paint. English by default. */
export type ChainOfThoughtTranslations = Record<ChainOfThoughtStatus, string>;

const ENGLISH: ChainOfThoughtTranslations = {
  complete: "Done",
  active: "In progress",
  waiting: "Waiting for you",
  pending: "Not started",
};

/**
 * The steps of the work, as a list the reader can follow: what is done, what is under way, what
 * waits on them and what is still to come, all visible at once. AI Elements' `ChainOfThought`, whose
 * step is the only row of theirs that carries a status, an icon, a label, a detail and a body — here
 * for the host's steps rather than the model's reasoning (`Reasoning` is that).
 *
 * **A list, so an `<ol>`**: the order is the meaning. `role="list"` stays on it because `list-none`
 * takes the implicit one away in WebKit (`MessageList` carries the argument).
 */
export const ChainOfThought = (props: React.ComponentProps<typeof ark.ol>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.ol
      className={cn("flex w-full list-none flex-col", className)}
      role="list"
      {...rest}
      data-slot={slot ?? "chain-of-thought"}
    />
  );
};

export interface ChainOfThoughtStepProps extends Omit<React.ComponentProps<typeof ark.li>, "title"> {
  /** The step's line. */
  label: React.ReactNode;
  /** Under the label, quieter: a detail of the step. */
  description?: React.ReactNode;
  /** Defaults to `complete`, as AI Elements' does. */
  status?: ChainOfThoughtStatus;
  /** A glyph in place of the status's own — a component, as AI Elements' `icon` is. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Trailing the row: the step's one verb, a link-button — *Open in the editor*. */
  action?: React.ReactNode;
  translations?: Partial<ChainOfThoughtTranslations>;
}

const INK: Record<ChainOfThoughtStatus, string> = {
  complete: "text-muted-foreground",
  active: "text-foreground",
  waiting: "text-foreground",
  // The same ink as a done step: a quieter one fails the contrast a label owes, and the hollow mark
  // already says it has not begun.
  pending: "text-muted-foreground",
};

const MARK: Record<ChainOfThoughtStatus, React.ReactNode> = {
  complete: <CircleCheckIcon className="text-success-foreground" />,
  active: <Spinner aria-hidden className="text-info-foreground" />,
  waiting: <CircleDashedIcon className="text-warning-foreground" />,
  pending: <CircleIcon className="text-muted-foreground" />,
};

/**
 * One step: its mark, its line and detail, anything the host puts under them, and `action` at the
 * end of the row. The mark is the status's unless `icon` gives another, and a rule runs down from it
 * to the next step.
 *
 * ARIA: the status is said in words — a visually hidden prefix on the label — because the mark is
 * `aria-hidden` and a colour or a glyph alone tells a screen reader nothing. The step that is the
 * work's present, `active` or `waiting`, is `aria-current="step"`.
 */
export const ChainOfThoughtStep = (props: ChainOfThoughtStepProps) => {
  const { label, description, status = "complete", icon: Icon, action, translations, className, children, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const current = status === "active" || status === "waiting";

  return (
    <ark.li
      aria-current={current ? "step" : undefined}
      className={cn("group/step flex gap-2 pb-3 text-sm last:pb-0", INK[status], className)}
      data-status={status}
      {...rest}
      data-slot={slot ?? "chain-of-thought-step"}
    >
      <div aria-hidden className="flex shrink-0 flex-col items-center gap-1 pt-0.5 [&_svg:not([class*='size-'])]:size-4">
        {Icon ? <Icon className="size-4" /> : MARK[status]}
        <span className="w-px flex-1 bg-border group-last/step:hidden" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div>
          <span className="sr-only">{t[status]}: </span>
          {label}
        </div>
        {description && <div className="text-muted-foreground text-xs">{description}</div>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </ark.li>
  );
};
