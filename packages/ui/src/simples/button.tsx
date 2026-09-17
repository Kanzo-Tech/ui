import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

/**
 * The whole control: the fill, the ink, the edge, the lift, both washes and the height, all on the
 * `base` and all written once in terms of three locals a variant assigns.
 *
 * **The shape is daisyUI's.** Their `.btn-primary` is two custom-property assignments over a `.btn`
 * that derives every state; ours was six variants of five to six utilities each, naming eight
 * different tokens between them, with the hover of each written separately. A hover rule that lives
 * in six places is a hover rule that drifts in six places.
 *
 * **The placement is daisyUI's too, and that half arrived late.** The derivations sat in
 * `styles.css` under `[data-slot="button"]`, which is the one attribute this library invites a
 * caller to RENAME — every part takes `slot?: string`. So every component of ours that renames a
 * `Button` got the variant's three assignments and no rule that read them: `AlertDialogAction` and
 * `AlertDialogCancel` reported their `data-variant` correctly and `background-color:
 * rgba(0, 0, 0, 0)` in a live document, and twenty-nine more call sites sat on the same fault.
 * `05f3a0a` had already moved the *height* here for exactly this reason and left the colour behind,
 * on the argument that losing a colour on a rename is a caller asking for a different look — which
 * is true of a caller and was never true of us. `no-paint-on-a-renameable-slot.test.ts` holds it.
 *
 * What a variant may set: `--btn-bg`, `--btn-fg`, `--btn-bd`. Nothing else here paints.
 */
export const buttonVariants = tv({
  base: [
    "relative",
    // Nothing below may be keyed on `data-slot`. See the docblock: `--size` was moved here first,
    // in `05f3a0a`, and the paint followed it once the same rename was measured against the colour.
    "h-(--size)",
    // The only one of the three locals a variant may leave unset — `outline` is the sole variant
    // that assigns `--btn-bd`, while all six assign the fill and the ink. A default for those two
    // would be a line that is overwritten every single render.
    "[--btn-bd:transparent]",
    // Derived, never assigned by a variant. `--depth: 0` collapses the edge and the lift to
    // nothing, which is what the library looks like today; `1` gives it relief. Same classes.
    //
    // daisyUI darkens a fill with `color-mix(in oklab, var(--btn-bg), #000 5%)`. Mixing toward
    // `--foreground` instead is a divergence taken on a reason: `black` is only "darker" in a light
    // theme, and on a dark one the hover of a pale button should move toward white. One formula
    // reads as "push this fill away from the page and toward the ink" in both, and it follows a
    // tenant's document instead of a constant — which is also why `--depth` can be a single number.
    // Their half-pixel inset gloss needs a colour that is toward the light side in both modes and
    // neither `--foreground` nor `--background` is that, so it waits for a reason to exist.
    "[--btn-edge:color-mix(in_oklab,var(--btn-bd),var(--foreground)_calc(var(--depth)*8%))]",
    "[--btn-lift:color-mix(in_oklab,var(--btn-bg)_calc(var(--depth)*30%),transparent)]",
    "bg-(--btn-bg) text-(--btn-fg)",
    // The grain, and the whole of the conditional that switches it off: at `--noise: 0` the layer
    // is sized to zero and never painted, at `1` it tiles. No variant — which is the property that
    // lets it be a value a tenant sets rather than a look somebody has to write. It defaults to `0`
    // here rather than in every theme, because a theme that wants no texture is saying nothing.
    "bg-(image:--fx-noise) bg-size-[calc(var(--noise,0)*100%)]",
    // `rounded-[var(--radius-field)]` and not `rounded-field`, which is the same radius and the
    // spelling every other recipe here uses: `tailwind-merge` knows nothing about a theme key it
    // was never configured with, so `rounded-field` and a caller's `rounded-full` both survive the
    // merge and the winner is whichever Tailwind happened to emit last. The `pill` variant is that
    // caller. An arbitrary value is in a group the merge does know.
    "border-[length:var(--stroke)] border-(--btn-edge) rounded-[var(--radius-field)]",
    // As `shadow-*` rather than a raw `box-shadow`, so it composes with `focus-visible:ring-[3px]`
    // through Tailwind's shadow chain instead of being replaced by it. At `--depth: 0` the lift is
    // transparent and nothing is drawn either way, which is why that was invisible before.
    "shadow-[0_3px_2px_-2px_var(--btn-lift),0_4px_3px_-2px_var(--btn-lift)]",
    // One hover and one active for every variant, solid and transparent alike — and the transparent
    // case is the tell that the formula is right. Mixing `transparent` with the foreground at 10%
    // IS the foreground at 10% alpha, which is exactly the wash a ghost button wants.
    //
    // The CSS rule guarded these with `:not(:disabled, [aria-disabled="true"], [data-disabled])`.
    // All three spellings already carry `pointer-events-none` on this same base and an element with
    // `pointer-events: none` can match neither `:hover` nor `:active`, so the guard was
    // belt-and-braces. Dropping it is not tidiness: with the plain modifier, `tailwind-merge` can
    // see a variant's own `hover:bg-*` as the same utility and let it win — which is how `link`
    // opts out in one class, instead of losing to a longer selector on specificity.
    "hover:bg-[color-mix(in_oklab,var(--btn-bg),var(--foreground)_10%)]",
    "active:bg-[color-mix(in_oklab,var(--btn-bg),var(--foreground)_16%)]",
    "inline-flex shrink-0 items-center justify-center gap-2",
    "whitespace-nowrap font-medium text-sm",
    "border-solid",
    "transition-all",
    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-64",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "aria-disabled:pointer-events-none aria-disabled:opacity-64",
    "data-[state=loading]:pointer-events-none",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/24",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    "motion-reduce:transition-none!",
  ],
  variants: {
    variant: {
      default: [
        "[--btn-bg:var(--primary)]",
        "[--btn-fg:var(--primary-foreground)]",
        "focus-visible:border-background",
      ],
      outline: [
        "[--btn-bg:transparent]",
        "[--btn-fg:var(--foreground)]",
        "[--btn-bd:var(--input)]",
        "focus-visible:border-primary",
      ],
      destructive: [
        "[--btn-bg:var(--destructive)]",
        // Was `text-white` at 3.81 on red-500. The fill moved to `-600` and the ink became a token,
        // because no choice of ink rescued red-500: white 3.81, near-black 4.15, AA needs 4.5.
        "[--btn-fg:var(--destructive-content)]",
        "focus-visible:border-background focus-visible:ring-destructive-foreground/32",
      ],
      secondary: [
        "[--btn-bg:var(--secondary)]",
        "[--btn-fg:var(--secondary-foreground)]",
        "focus-visible:border-primary",
      ],
      ghost: [
        "[--btn-bg:transparent]",
        "[--btn-fg:var(--foreground)]",
        "focus-visible:border-primary",
      ],
      // The one variant that opts OUT of the shared hover, because a link's hover is an underline
      // and not a wash. Same modifier and same utility group as the base's wash, so
      // `tailwind-variants` merges the two and the variant wins — which is what makes opting out
      // one class rather than an exception somewhere else.
      link: [
        "[--btn-bg:transparent]",
        "[--btn-fg:var(--primary)]",
        "underline-offset-4",
        "hover:bg-transparent hover:underline active:bg-transparent",
        "focus-visible:border-primary",
      ],
    },
    /**
     * Padding, gaps and icon sizes. A size variant only **moves `--size`** — the height that reads
     * it is on the `base` — so a tenant can ask for compact controls, through `--size-field`,
     * without asking for tighter text.
     *
     * The floor is still measured rather than chosen. `xs` and `icon-xs` were both `1.5rem`, and
     * every size is a `rem` against a root the density axis sets — 16px default, 14px compact, 18px
     * comfortable — so they measured **21px in compact**, under the 24×24 WCAG 2.5.8 states in CSS
     * pixels. `sm` is the smallest size that clears the bar in all three densities. No call site was
     * failing: the spacing exception saves a clustered control, and every measured `xs` was in a
     * cluster. The variant went because its NAME promised a size it could not deliver at one
     * density, and nothing was published to break.
     */
    size: {
      sm: ["[--size:calc(var(--size-field)*7)]", "px-2.5", "gap-1.5", "[&_svg:not([class*='size-'])]:size-3.5"],
      md: ["[--size:calc(var(--size-field)*8)]", "px-3", "py-2"],
      lg: ["[--size:calc(var(--size-field)*9)]", "px-3.5"],
      xl: ["[--size:calc(var(--size-field)*10)]", "text-base", "px-4"],
      // Square, and the width is stated rather than left to `aspect-ratio`: a caller who writes
      // `w-fit` on top of an aspect ratio gets the icon's own width and a control twice as tall.
      "icon-sm": ["[--size:calc(var(--size-field)*7)]", "w-(--size)", "px-0"],
      "icon-md": ["[--size:calc(var(--size-field)*8)]", "w-(--size)", "px-0"],
      "icon-lg": ["[--size:calc(var(--size-field)*9)]", "w-(--size)", "px-0"],
      "icon-xl": [
        "[--size:calc(var(--size-field)*10)]",
        "w-(--size)",
        "px-0",
        "[&_svg:not([class*='size-'])]:size-5",
      ],
    },
    clickEffect: {
      true: "active:not-aria-[haspopup]:scale-[0.98]",
    },
    pill: {
      true: [
        "rounded-full",
        "has-[>svg]:data-[size=sm]:pe-3.5",
        "has-[>svg]:data-[size=md]:pe-4",
        "has-[>svg]:data-[size=lg]:pe-4.5",
        "has-[>svg]:data-[size=xl]:pe-5",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    clickEffect: true,
    pill: false,
  },
});

export interface ButtonProps
  extends React.ComponentProps<typeof ark.button>,
    VariantProps<typeof buttonVariants> {
  /**
   * Apply a click effect to the button
   *
   * @default true
   */
  clickEffect?: boolean;
  /**
   * Show a loading indicator
   *
   * @default false
   */
  isLoading?: boolean;
}

export const Button = (props: ButtonProps) => {
  const {
    variant = "default",
    size = "md",
    clickEffect = true,
    pill = false,
    isLoading = false,
    className,
    children,
    slot,
    ...rest
  } = props;

  return (
    <ark.button
      className={cn(
        buttonVariants({ variant, size, clickEffect, pill }),
        className
      )}
      data-size={size}
      data-state={isLoading ? "loading" : "idle"}
      data-variant={variant}
      type="button"
      {...rest}
      data-slot={slot ?? "button"}
      aria-busy={isLoading}
      aria-disabled={isLoading}
    >
      {isLoading ? (
        <>
          <span aria-hidden className="invisible">
            {children}
          </span>

          <span className="sr-only">{children}</span>

          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner aria-hidden />
          </span>
        </>
      ) : (
        children
      )}
    </ark.button>
  );
};
