"use client";

import { XIcon } from "lucide-react";
import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { Button, ButtonGroup, cn, Spinner, Suggestion, Suggestions } from "@kanzo-tech/ui";
import { AiMark, type AiMarkProps } from "./ai-mark.js";
import type { Suggestion as Candidate } from "./types.js";
import { type AiStatus, useSuggestions } from "./use-ai.js";

interface SuggestCtx {
  candidates: Candidate[];
  status: AiStatus;
  error: string | null;
  /** The field, or something inside it, holds focus. */
  active: boolean;
  ask: () => void;
  pick: (value: string) => void;
  dismiss: (value: string) => void;
}

const Ctx = React.createContext<SuggestCtx | null>(null);
const useCtx = (part: string): SuggestCtx => {
  const context = React.useContext(Ctx);
  if (!context) throw new Error(`${part} must render inside <SuggestRoot>`);
  return context;
};

/** When the source is asked. */
export type SuggestTrigger =
  /** On a press of the ✨. Nothing is requested until somebody asks for it. */
  | "press"
  /** As soon as the field takes focus. Prefetches, and bills a model for a tab-through. */
  | "focus";

export interface SuggestRootProps
  extends Omit<React.ComponentProps<typeof ark.div>, "onSelect"> {
  /** The source. Yields candidates; honour the `AbortSignal`. */
  suggest: (signal?: AbortSignal) => AsyncIterable<Candidate>;
  /** What the field already holds — these are never offered back. */
  existing?: string[];
  /** Where a chosen value goes. */
  onPick: (value: string) => void;
  /**
   * How many to take from the stream.
   *
   * @default 6
   */
  limit?: number;
  /**
   * @default "press"
   */
  trigger?: SuggestTrigger;
}

/**
 * Candidate values for one field, offered **in the flow underneath it**.
 *
 * This replaced a popover, and the popover is the whole story. Hiding the candidates behind a door
 * bought nothing and cost six workarounds, every one of them downstream of the door and not of the
 * candidates: a non-modal popover, because a modal one put `pointer-events: none` on the very field
 * the values were for; a `data-autofocus`, because a popover has to hand focus somewhere; a
 * `Delete`/`Backspace` handler, because a button inside `role="option"` is unreachable by Tab; a
 * shared label id, because a popover names itself from a title and a listbox from a label; a ✕ that
 * had to be quieted because an offer looked identical to a committed tag; and a three-row window
 * with a refill loop in the hook to keep it full. None of them exist here.
 *
 * **Focus decides visibility, a press decides billing**, and they are deliberately not the same
 * gesture. The strip appears while the field has focus and there is something to show — which is
 * what keeps a form of eleven fields from becoming a wall, since only one field is focused at a
 * time. Asking is `trigger`, and it defaults to a press: a source that fires on focus bills a model
 * for a tab-through, and that is a decision a caller should make on purpose.
 */
export function SuggestRoot(props: SuggestRootProps) {
  const {
    suggest,
    existing,
    onPick,
    limit,
    trigger = "press",
    children,
    className,
    onBlur,
    onFocus,
    slot,
    ...rest
  } = props;

  const controller = useSuggestions({ suggest, existing, limit });
  const [active, setActive] = React.useState(false);

  const pick = (value: string) => {
    onPick(value);
    // A taken candidate is no longer a candidate. Nothing refills — the strip simply gets shorter,
    // which is the honest picture of a source that has already answered.
    controller.dismiss(value);
  };

  /**
   * **One meaning for a press, in both compounds: give me the assistance.**
   *
   * `Complete` reads that as *take the continuation* when there is one, because a ghost is a single
   * offer that needs a gesture to accept. A strip is N offers that already carry their own buttons,
   * so here the next useful thing is a different set — and after a failure it is a retry. The hook's
   * `ask` stays strict (idle only, so a press cannot re-bill a source that already answered) and
   * this is where the policy lives, which is why it is in the compound and not in `AiMark`.
   *
   * Loading is the one state where nothing happens: the mark is a spinner then, and a spinner you
   * can press is a lie.
   */
  const press = () => {
    if (controller.status === "loading") return;
    if (controller.status === "error" || controller.items.length > 0) controller.refresh();
    else controller.ask();
  };

  return (
    <Ctx.Provider
      value={{
        candidates: controller.items,
        status: controller.status,
        error: controller.error,
        active,
        ask: press,
        pick,
        dismiss: controller.dismiss,
      }}
    >
      <ark.div
        className={cn("flex w-full min-w-0 flex-col gap-2", className)}
        onBlur={(event) => {
          onBlur?.(event);
          // `relatedTarget` is where focus is going. Inside our own subtree it is a pill being
          // clicked or the ✨ being tabbed to, and the strip must survive both.
          if (!event.currentTarget.contains(event.relatedTarget)) setActive(false);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          setActive(true);
          if (trigger === "focus") controller.ask();
        }}
        {...rest}
        data-slot={slot ?? "suggest"}
      >
        {children}
      </ark.div>
    </Ctx.Provider>
  );
}

/**
 * The ✨ — **a mark, not a door.**
 *
 * At rest it says the field is model-assisted, which a reader can see without touching anything.
 * Pressing it asks. It no longer opens or closes a layer, so there is no `data-state` to light it
 * from and nothing to trap focus in.
 */
export function SuggestMark(props: Omit<AiMarkProps, "busy" | "offering">) {
  const { label = "Suggest", onClick, ...rest } = props;
  const ctx = useCtx("SuggestMark");
  // Bound exactly as `CompleteMark` binds it. A mark that paints one way over a ghost and another
  // over a strip reads as two products; `ai-mark.test.tsx` is the guard on that.
  const offering = ctx.candidates.length > 0;

  return (
    <AiMark
      busy={ctx.status === "loading" && !offering}
      label={offering ? "Suggest different values" : label}
      offering={offering}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.ask();
      }}
      {...rest}
    />
  );
}

export interface SuggestListProps extends React.ComponentProps<typeof Suggestions> {
  /** Shown while the source is answering and has produced nothing yet. */
  pending?: React.ReactNode;
  /** Shown when the source finished with nothing to offer. */
  empty?: React.ReactNode;
}

/**
 * The strip, and the only part that decides whether anything is on screen.
 *
 * It renders `Suggestions` from `@kanzo-tech/ui` — a row of buttons that knows nothing about a
 * model — so everything model-shaped stays on this side of the boundary: the ✨, the engine, and
 * the rationale that comes back with a candidate.
 *
 * The rationale is the highlighted pill's `title` rather than a line under the strip. The line was
 * tried and it moved the layout on every hover; a `title` is the browser's own tooltip, reaches the
 * keyboard through focus, and costs no box.
 */
export function SuggestList(props: SuggestListProps) {
  const { className, empty, pending, slot, ...rest } = props;
  const ctx = useCtx("SuggestList");

  if (!ctx.active) return null;

  const body =
    ctx.error !== null ? (
      <ark.p className="text-destructive-foreground text-sm" data-slot="suggest-error">
        {ctx.error}
      </ark.p>
    ) : ctx.candidates.length > 0 ? (
      ctx.candidates.map((candidate) => {
        const label = candidate.label ?? candidate.value;
        return (
          // **Two buttons, so a group — not a ✕ inside the pill.** `Suggestion` *is* a
          // `<button>`, and a button inside a button is not a thing the DOM has; the dismiss has
          // to be a sibling. `ButtonGroup` is the house cluster: it collapses the inner radii and
          // overlaps the shared border, so the pair reads as one pill with a divided end, and it
          // requires the accessible name that a `role="group"` owes.
          <ButtonGroup aria-label={label} key={candidate.value} slot="suggest-item">
            <Suggestion onSelect={ctx.pick} title={candidate.rationale} value={candidate.value}>
              {label}
            </Suggestion>
            {/* Always drawn, never on hover: a hover-only control is unreachable by a keyboard and
                absent on a touch pointer, and this strip is explicitly reachable by Tab. */}
            <Button
              aria-label={`Dismiss ${label}`}
              className="h-auto min-h-[24px] self-stretch px-2 py-1"
              onClick={() => ctx.dismiss(candidate.value)}
              pill
              size="sm"
              slot="suggest-dismiss"
              variant="outline"
            >
              <XIcon />
            </Button>
          </ButtonGroup>
        );
      })
    ) : ctx.status === "loading" ? (
      (pending ?? (
        <ark.span
          className="inline-flex items-center gap-2 text-muted-foreground text-sm"
          data-slot="suggest-pending"
        >
          <Spinner aria-hidden />
          Thinking…
        </ark.span>
      ))
    ) : ctx.status === "ready" ? (
      (empty ?? (
        <ark.span className="text-muted-foreground text-sm" data-slot="suggest-empty">
          Nothing to suggest.
        </ark.span>
      ))
    ) : null;

  if (body === null) return null;

  return (
    <Suggestions className={cn("min-h-8", className)} {...rest} slot={slot ?? "suggest-list"}>
      {body}
    </Suggestions>
  );
}
