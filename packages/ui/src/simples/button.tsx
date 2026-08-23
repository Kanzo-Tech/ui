import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

/**
 * Everything a class list can say. The rest — the fill, the ink, the edge, the lift, the hover, the
 * active and the height — is one block of real CSS in `styles.css`, written once in terms of three
 * locals, and this file assigns those three.
 *
 * **That is the whole shape of the change, and it is daisyUI's.** Their `.btn-primary` is two
 * custom-property assignments over a `.btn` that derives every state; ours was six variants of five
 * to six utilities each, naming eight different tokens between them, with the hover of each written
 * separately. A hover rule that lives in six places is a hover rule that drifts in six places, and
 * three of the comments this file used to carry were measurements taken to settle one of those
 * drifts.
 *
 * What a variant may set: `--btn-bg`, `--btn-fg`, `--btn-bd`. Nothing else here paints.
 */
export const buttonVariants = tv({
  base: [
    "relative",
    // The height is HERE, on the base, and every size variant only moves `--size`. Keyed off the
    // part's own name instead — `[data-slot="button"][data-size="sm"]` — it was keyed off the one
    // attribute this library lets a caller rename, and a renamed part silently lost its height:
    // `ConversationScrollButton` measured 16×16 against a 24×24 floor. daisyUI's `.btn` does it
    // this way for the same reason, and `no-measurement-on-a-renameable-slot.test.ts` holds it.
    "h-(--size)",
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
      // and not a wash. A utility beats the recipe base by cascade layer, which is what makes
      // opting out one class rather than an exception in the CSS.
      link: [
        "[--btn-bg:transparent]",
        "[--btn-fg:var(--primary)]",
        "underline-offset-4",
        "hover:bg-transparent hover:underline active:bg-transparent",
        "focus-visible:border-primary",
      ],
    },
    /**
     * Padding, gaps and icon sizes. **The heights are not here** — they are `--size-field` in
     * `styles.css`, keyed off the `data-size` this recipe already writes, so a tenant can ask for
     * compact controls without asking for tighter text.
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
