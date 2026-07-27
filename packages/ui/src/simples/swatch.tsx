import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

/**
 * A colour, drawn.
 *
 * Ark has no machine for this and should not: a swatch has no behaviour. What it does have is an
 * ARIA contract, and stating it is the whole reason this is a component rather than a `<span>` at
 * each call site — colour is never an identity channel on its own, so a swatch always sits beside
 * text that names the thing it depicts. It is `aria-hidden`, carries no role and is never
 * focusable. Wanting a focusable one means wanting something else: `ColorPickerSwatchTrigger` if
 * the colour *is* the value, or a `RadioGroupCard` around this if the colour merely pictures a
 * value that has a name.
 *
 * That distinction is load-bearing and was checked rather than assumed. Ark's swatch parts cannot
 * serve as a display strip: all of them call `useColorPickerContext`, which is `strict` and throws
 * outside a picker; `data-state="checked"` is computed as `color.isEqual(value)` against the one
 * colour the machine holds, so in a strip of sixteen the highlight would land on whichever slot
 * happened to match; and every trigger is a button labelled `select #2e3440 as the color`, which is
 * the wrong sentence when what the reader is choosing is "Nord".
 */
export const swatchVariants = tv({
  base: "shrink-0",
  variants: {
    size: { xs: "size-2.5", sm: "size-3", md: "size-4", lg: "size-5" },
    shape: { square: "rounded-[2px]", round: "rounded-full" },
  },
  defaultVariants: { size: "sm", shape: "square" },
});

export interface SwatchProps
  extends Omit<React.ComponentProps<typeof ark.span>, "color">,
    VariantProps<typeof swatchVariants> {
  /** The colour to paint. Data, not a variant — the sanctioned inline-style case. */
  color: string;
}

export const Swatch = ({ color, size, shape, className, style, ...rest }: SwatchProps) => (
  <ark.span
    aria-hidden
    className={cn(swatchVariants({ size, shape }), className)}
    data-slot="swatch"
    style={{ background: color, ...style }}
    {...rest}
  />
);

export interface SwatchGroupProps
  extends Omit<React.ComponentProps<typeof ark.span>, "color">,
    VariantProps<typeof swatchVariants> {
  /**
   * The colours, in order.
   *
   * Order is meaning, so this never sorts: for a categorical scheme the sequence *is* the
   * colour-blindness mechanism (`orderScheme` derives it), and for a palette it is base16's slot
   * order. A strip that tidied its input would be quietly discarding the reason it was ordered.
   */
  colors: readonly string[];
}

export const SwatchGroup = ({ colors, size, shape, className, ...rest }: SwatchGroupProps) => (
  <ark.span
    aria-hidden
    className={cn("flex items-center gap-0.5", className)}
    data-slot="swatch-group"
    {...rest}
  >
    {colors.map((c, i) => (
      <Swatch color={c} key={`${i}-${c}`} shape={shape} size={size} />
    ))}
  </ark.span>
);
