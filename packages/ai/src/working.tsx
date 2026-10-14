import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn, Progress, Spinner } from "@kanzo-tech/ui";

export interface WorkingProps extends React.ComponentProps<typeof ark.div> {
  /**
   * How far along, as Ark's progress machine reads it: a number from 0 to 100 draws a bar under the
   * words, `null` draws it indeterminate, and leaving it out draws no bar — the common case.
   */
  value?: number | null;
}

/**
 * Work under way, said: a spinner and the words for what is being done — *Thinking…*, *Reading your
 * files… 4 of 6* — and, given a `value`, `@kanzo-tech/ui`'s `Progress` under them. What `Chat` draws
 * where an answer will be, and what a guided chat draws while a step runs.
 *
 * **A spinner, not AI Elements' `Shimmer`.** Their busy words are a gradient swept across the glyphs
 * on a `motion/react` loop — a second vocabulary for *busy*, costing an animation library, beside the
 * one this library already speaks: every busy surface here spins. AI Elements' own `Loader` has since
 * become shadcn's `Spinner`, which is this.
 *
 * **`value` is Ark's spelling, not `Progress`'s.** The machine takes `number | null`, `null` meaning
 * indeterminate; `Progress` splits that into `value` and `indeterminate`. Here `undefined` has a third
 * meaning to carry — no bar at all — and the machine's own two-way spelling leaves it free.
 *
 * ARIA: `role="status"`, so the words are announced when they change, after what the reader is on.
 * The spinner is `aria-hidden` — it is a `role="status"` of its own, and two would announce twice.
 * The bar is Ark's `progressbar`, named by its value and carrying no text, so it adds nothing to what
 * the status announces.
 */
export const Working = (props: WorkingProps) => {
  const { className, children, slot, value, ...rest } = props;
  const said = (
    <>
      <Spinner aria-hidden className="shrink-0" />
      {children}
    </>
  );
  // With a bar the words keep their own line and the bar takes the one under it, at its own measure
  // rather than the words' width. A wrapping row would do it in one element, and would also drop the
  // words under the spinner on a narrow screen before letting them wrap.
  return (
    <ark.div
      className={cn(value === undefined ? "inline-flex items-center gap-2" : "flex flex-col gap-2", "text-muted-foreground", className)}
      role="status"
      {...rest}
      data-slot={slot ?? "working"}
    >
      {value === undefined ? (
        said
      ) : (
        <>
          <div className="inline-flex items-center gap-2">{said}</div>
          <Progress className="max-w-xs" indeterminate={value === null} value={value ?? undefined} />
        </>
      )}
    </ark.div>
  );
};
