"use client";

import { ark } from "@ark-ui/react/factory";
import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react";
import * as React from "react";
import { cn, Spinner } from "@kanzo-tech/ui";

/**
 * The life of one step. Shared with `Tool`, which imports it — a tool call is a step with a name,
 * and giving the two their own four-word vocabularies is how they end up disagreeing.
 */
export type RunState = "pending" | "running" | "done" | "failed";

/** The word for each state, in one place because `Tool`'s badge says the same four. */
export const RUN_LABEL: Record<RunState, string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

/**
 * The mark for each state — **shared with `Tool`, which imports it.** One icon family at one
 * stroke weight, tinted by the family's own `-foreground` token, which for a status family is the
 * readable-on-the-page variant rather than ink on a fill (`tokens.css` states both meanings).
 *
 * This was four `Status` dots, and `Status` is a presence dot: its recipe carries `ring-2
 * ring-background`, a halo for sitting on an avatar, which cut a 2px hole in the rail the marks
 * stand on. Fighting it took a `size-4` override of `size="lg"`'s 12px and a `bg-transparent
 * ring-1` hollowing for pending — a primitive argued with in three places is the wrong primitive.
 * `Tool` already drew these four states as icons; now there is one drawing of them, not two.
 *
 * Unsized on purpose: the parent sizes the glyph, so the same table serves a 16px rail mark and a
 * 12px badge icon.
 */
export const RUN_MARK: Record<RunState, React.ReactNode> = {
  pending: <CircleDashedIcon className="text-muted-foreground" />,
  running: <Spinner aria-hidden className="text-info-foreground" />,
  done: <CircleCheckIcon className="text-success-foreground" />,
  failed: <CircleXIcon className="text-destructive-foreground" />,
};

/** The state reaches the title through the root's `data-state`, so the title needs no context. */
// One weight across the five rows. The mark already says which step is running and which failed,
// and a second emphasis on the same fact reads as three type styles in a five-row list.
const TITLE = [
  "min-w-0 flex-1 truncate leading-5",
  "group-data-[state=pending]/task:text-muted-foreground",
  "group-data-[state=failed]/task:text-destructive-foreground",
].join(" ");

const Ctx = React.createContext<{ state: RunState } | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <Task>`);
  return c;
};

export const TaskList = (props: React.ComponentProps<typeof ark.ol>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.ol
      className={cn("flex w-full list-none flex-col gap-2", className)}
      // `role="list"`, because `list-none` takes the implicit one away in WebKit. See
      // `DiagnosticList` in `@kanzo-tech/ui` for the argument.
      role="list"
      {...rest}
      data-slot={slot ?? "task-list"}
    />
  );
};

export interface TaskProps extends React.ComponentProps<typeof ark.li> {
  state?: RunState;
}

/**
 * One labelled step. The state is declared here and read off `data-state` by the parts.
 *
 * The rail through the markers is the step's own `::after` rather than a border on the list: a run
 * of five has to read as one run, and the last step must not trail a line into nothing.
 */
export const Task = (props: TaskProps) => {
  const { state = "pending", className, children, slot, ...rest } = props;

  return (
    <Ctx.Provider value={{ state }}>
      <ark.li
        className={cn(
          "group/task relative flex w-full items-start gap-2.5 text-sm",
          "after:absolute after:top-5 after:-bottom-2 after:start-2.5 after:w-px after:bg-border",
          "last:after:hidden",
          className
        )}
        data-state={state}
        {...rest}
        data-slot={slot ?? "task"}
      >
        {children}
      </ark.li>
    </Ctx.Provider>
  );
};

export const TaskTitle = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      className={cn(TITLE, className)}
      {...rest}
      data-slot={slot ?? "task-title"}
    />
  );
};

/**
 * The step's marker — {@link RUN_MARK} for this step's state, in a box the rail runs out of.
 *
 * The mark is decorative to a screen reader; the word beside it is what carries the state, and it
 * is written here as `sr-only` rather than assumed of the title. Pass children to say it in your
 * own words.
 *
 * The box is `size-5` and centred so the mark lands on the first line's optical centre: `text-sm`
 * is a 20px line box, and a marker aligned to the top of a wrapping title sits above its own text.
 */
export const TaskStatus = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, children, slot, ...rest } = props;
  const { state } = useCtx("TaskStatus");

  return (
    <ark.span
      className={cn(
        "relative z-10 flex size-5 shrink-0 items-center justify-center",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        className
      )}
      data-state={state}
      {...rest}
      data-slot={slot ?? "task-status"}
    >
      {RUN_MARK[state]}
      <ark.span className="sr-only">{children ?? RUN_LABEL[state]}</ark.span>
    </ark.span>
  );
};
