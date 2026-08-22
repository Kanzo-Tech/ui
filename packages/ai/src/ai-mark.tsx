import { SparklesIcon } from "lucide-react";
import type * as React from "react";
import { tv } from "tailwind-variants";
import { cn, InputGroupButton } from "@kanzo-tech/ui";

const aiMarkVariants = tv({
  base: [
    "text-muted-foreground",
    "transition-colors",
    "motion-reduce:transition-none!",
  ],
  variants: {
    tone: {
      rest: "",
      /**
       * Lit, not merely recoloured.
       *
       * `text-primary` alone was the whole offering state, and at 16px against a resting
       * `text-muted-foreground` it is a change a reader has to be looking for. The mark is the one
       * thing on screen that says *there is something here* to somebody whose eyes are on the field
       * rather than on the ghost, so it carries the tenant's brand the way every other "this one is
       * chosen" surface in the library does — `RadioGroupCard`, `Questionnaire` and `CodeEditor`'s
       * selection all spell it `bg-primary/17`.
       *
       * **No border, and that is geometry rather than taste.** `RadioGroupCard` pairs this wash with
       * `border-primary` and it is the right pair — but there is nowhere to draw it here. Measured
       * on `docs/ai/fields`: the group is 32px *including* its 1px border, so its content box is
       * 30px, and `InputGroupButton` is 32px because 24px failed WCAG 2.5.8 at compact density. The
       * mark therefore overhangs the content box by exactly 1px top and bottom, which is precisely
       * where the group's own border is drawn — so a border on the mark lands on top of the field's.
       * Fixing that is `InputGroupAddon`'s to fix, and it is filed.
       *
       * What this costs: on a palette whose brand is neutral, `--brand-a5` resolves to `#0000001f`,
       * black at 12%, and the lit state reads closer to hover than to lit. That is the palette
       * having no hue to light up with rather than this rule being wrong, and it comes right the
       * moment a tenant chooses one.
       *
       * The hover pair is repeated on purpose: `Button`'s ghost variant sets `hover:bg-accent`, and
       * without these the mark would go *out* under the pointer at the exact moment it is being
       * reached for. No animation of its own — the base already carries `transition-colors` and the
       * `motion-reduce` escape, so it comes up rather than snapping, and stays still for a reader
       * who asked for that.
       */
      offer: "bg-primary/17 text-primary hover:bg-primary/30 hover:text-primary",
    },
  },
  defaultVariants: { tone: "rest" },
});

export interface AiMarkProps
  extends Omit<React.ComponentProps<typeof InputGroupButton>, "children" | "size"> {
  /** Something is on offer right now — paints only; see {@link AiMarkProps.label}. */
  offering?: boolean;
  /** A request is in flight. */
  busy?: boolean;
  /**
   * The whole accessible name, and the only thing that carries state to a reader who cannot see
   * the colour — so a caller that sets `offering` names the offer too, the way `CompleteMark`
   * does.
   */
  label?: string;
}

/**
 * The ✨ that says a field is model-assisted.
 *
 * It is a **statement before it is a button**: quiet at rest, so a reader can tell an assisted
 * field from a plain one without touching it, brighter while something is on offer, a spinner
 * while a request is out.
 *
 * ## Both compounds bind it the same way, and that is a rule
 *
 * A mark that paints one way over a ghost and another over a candidate strip reads as two products
 * rather than one library, so `CompleteMark` and `SuggestMark` derive their props identically:
 *
 * - `offering` — *there is something on offer*: a ghost, or candidates on screen. It used to be set
 *   only over a ghost, so a strip full of candidates left the mark at rest.
 * - `busy` — *a request is out and nothing has arrived yet*, `loading && !offering`. A bare
 *   `loading` spun on top of candidates that were already there.
 * - The press means **give me the assistance**, and each compound reads that in its own domain: a
 *   ghost is one offer that needs a gesture, so pressing takes it; a strip is N offers that carry
 *   their own buttons, so pressing asks for a different set. Neither is ever inert.
 *
 * The only binding that differs is `disabled`, and it differs for a reason rather than by accident:
 * there is nothing to continue below a minimum length, while a candidate source can answer from an
 * empty field.
 *
 * **Nothing here keys off `:hover`.** A hover-revealed mark is invisible to touch and to the
 * keyboard, and a hover-fired request bills a model for a pointer crossing the field. The state
 * comes from the caller's own knowledge of the stream; focus and a press are the gestures.
 *
 * An `InputGroupButton` rather than a bare `Button` because the mark belongs **inside** the field,
 * in an `InputGroupAddon`: what it marks is the control, so it sits in the control's box and stays
 * with it whether the row above is a label, a legend or nothing — and the addon's coarse-pointer
 * hit area already applies there. It renders standalone too; the group selectors simply never
 * match.
 *
 * There was a `data-[state=open]:text-primary` rule here for the days when pressing it opened a
 * candidate popover and `PopoverTrigger asChild` wrote `data-state` onto it. Nothing opens now, so
 * nothing writes that attribute and the rule matched nothing.
 */
export function AiMark(props: AiMarkProps) {
  const { busy = false, className, label = "AI assist", offering = false, slot, title, ...rest } = props;

  return (
    <InputGroupButton
      aria-label={label}
      className={cn(aiMarkVariants({ tone: offering ? "offer" : "rest" }), className)}
      data-offering={offering || undefined}
      // `Button`'s own loading contract, not a spinner of ours. It used to render `<Spinner />` in
      // place of the glyph and write its own `aria-busy` — which never reached the DOM, because
      // `Button` writes `aria-busy={isLoading}` AFTER spreading props and always won. So the mark
      // spun on screen while telling a screen reader it was idle, and stayed pressable while it
      // did. One machine now: the spinner, `aria-busy`, `aria-disabled` and `data-state` all come
      // from the primitive, and a spinner you can press stops being a lie.
      isLoading={busy}
      size="icon-sm"
      // The browser's own tooltip, for the same reason `SuggestList` gives a candidate's rationale
      // one: it reaches the keyboard through focus and costs no box. A 16px glyph with an
      // accessible name and no visible one tells a pointer reader nothing at all.
      title={title ?? label}
      {...rest}
      slot={slot ?? "ai-mark"}
    >
      <SparklesIcon />
    </InputGroupButton>
  );
}
