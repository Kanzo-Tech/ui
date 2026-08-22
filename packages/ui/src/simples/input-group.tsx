"use client";

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";

const inpuGroupVariants = tv({
  base: [
    "group/input-group",
    "relative",
    "w-full min-w-0",
    "flex items-center",
    "bg-background bg-field",
    "rounded-lg border border-input shadow-xs/5",
    "transition-[color,box-shadow]",
    // **The group holds its controls; it does not press them against its border.**
    //
    // The height used to be fixed — `h-8` at `md`, a border-box 32px with 1px of border — while
    // `InputGroupButton`'s `icon-sm` is `size-8`, also 32px. A fixed box cannot contain a control
    // its own size, so the ✨ painted over the border a pixel above and below, and two at `sm`.
    // Measured on `/docs/ai/fields`.
    //
    // Sizing the control down instead was tried and rejected on sight: it made the ✨ a different
    // size here than the identical mark inside a `TagsInput`, which is the same component doing
    // the same job. **`TagsInput` is the shape, and it is now literally the same one** — `p-1.5`
    // around a `min-h-*` box, so the group grows to whatever it holds and every control keeps the
    // size it has everywhere else. A group holding a 32px mark measures 46px, exactly as
    // `TagsInputControl` does.
    //
    // The input's own `px-3` is replaced by `px-1.5` so the group's padding and the field's do not
    // add up: 1px of border plus 6px of padding plus 6px is the 13px of inset the fixed-height
    // version had, unchanged.
    "[&>input]:px-1.5 [&>textarea]:px-1.5",
    "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
    "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
    "outline-none focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring",
    "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-[3px] has-[[data-slot][aria-invalid=true]]:ring-destructive/24",
    "dark:has-[[data-slot][aria-invalid=true]]:border-destructive-foreground dark:has-[[data-slot][aria-invalid=true]]:ring-destructive-foreground/40",
    "motion-reduce:transition-none!",
  ],
  variants: {
    // `min-h`, not `h`: the box is sized by what it holds, and this is the floor it starts from.
    // A fixed height is what made a control the same size as the group overflow it.
    //
    // **The padding is what the size axis now moves, and it has to be.** A content-sized box whose
    // size variant only sets a floor is a size variant that does nothing: every group came out
    // 46px — `sm`, `md` and `lg` alike — because the `<input>` inside carries its own `h-8` and
    // that plus the padding cleared every floor. Measured on `/docs/forms/input-group`. Scaling
    // the inset instead keeps the controls identical across the three, which is the whole point of
    // this shape: an ✨ is the same ✨ in a small group, a large one and a `TagsInput`.
    size: {
      sm: ["min-h-7", "p-1"],
      md: ["min-h-8", "p-1.5"],
      lg: ["min-h-9", "p-2"],
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface InputGroupProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof inpuGroupVariants> {}

export const InputGroup = (props: InputGroupProps) => {
  const { size = "md", className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(inpuGroupVariants({ size }), className)}
      data-size={size}
      role="group"
      {...rest}
      data-slot={slot ?? "input-group"}
    />
  );
};

const inputGroupAddonVariants = tv({
  base: [
    "h-auto",
    "flex items-center justify-center gap-2",
    "select-none font-medium text-muted-foreground text-sm",
    "cursor-text",
    "group-data-[disabled=true]/input-group:opacity-64",
    "[&>kbd]:rounded-[calc(var(--radius)-5px)]",
    "[&_svg:not([class*='size-'])]:size-4",
  ],
  variants: {
    align: {
      // **A smaller padding, not a negative margin**, and this is a measured divergence from the
      // reference rather than a taste one. Shark tucks the button in with `pe-3` plus
      // `me-[-0.45rem]`; a negative margin on the last flex item lets its border box run past the
      // container's content edge, so measured live on `docs/ai/fields` the addon sat **6.2px
      // outside the group's inline border and 6px outside its block border** — in a box with
      // `overflow: visible`, which is why it also showed up as 6px of scroll width on the parent.
      // The inner gap is what was wanted and it is unchanged: 12px of padding minus 7.2px of
      // margin is the 6px this sets directly.
      // **A button needs no padding beside it — the group's own `p-1.5` is the inset**, and this
      // is what puts the ✨ the same distance from the border here as inside a `TagsInputControl`.
      // Text and a `kbd` still take theirs, because neither carries a box of its own.
      "inline-start": ["order-first ps-3", "has-[>button]:ps-0", "has-[>kbd]:ps-2"],
      "inline-end": ["order-last pe-3", "has-[>button]:pe-0", "has-[>kbd]:pe-2"],
      // The block padding lives on the two block aligns and nowhere else. It was `py-1.5` in the
      // base, which is right for a band across the field and wrong for a control tucked into its
      // end: measured on `docs/ai/fields`, an `inline-end` addon was **44px tall inside a 32px
      // group** — 6px of transparent padding past the border on each side, in a box with
      // `overflow: visible`. The mark inside it is `size-8` and looked fine; what was wrong was the
      // group's own box.
      "block-start": [
        "order-first w-full justify-start px-3 pt-3 pb-1.5",
        "group-has-[>input]/input-group:pt-2.5",
        "[.border-b]:pb-3",
      ],
      "block-end": [
        "order-last w-full justify-start px-3 pt-1.5 pb-3",
        "group-has-[>input]/input-group:pb-2.5",
        "[.border-t]:pt-3",
      ],
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
});

interface InputGroupAddonProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof inputGroupAddonVariants> {}

export const InputGroupAddon = (props: InputGroupAddonProps) => {
  const { className, align = "inline-start", slot, ...rest } = props;

  return (
    <ark.div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      role="group"
      {...rest}
      data-slot={slot ?? "input-group-addon"}
    />
  );
};

const inputGroupButtonVariants = tv({
  base: [
    "relative",
    "flex items-center gap-2",
    "text-sm",
    "shadow-none",
    "pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
  ],
  variants: {
    size: {
      /**
       * The floor, and the default, because there is nothing legal below it.
       *
       * `xs` and `icon-xs` were `1.5rem`, which is 24px at the default root and **21px at compact** —
       * every size here is a `rem` against a root the density axis sets. That is under the 24×24
       * WCAG 2.5.8 states in CSS pixels, and it was this component's DEFAULT, so an input group
       * that said nothing got the failing size.
       *
       * The `pointer-coarse` hit area below does not save it. 44px is the touch answer and 2.5.8
       * asks about pointers generally: with a mouse the target was 21px and the `::after` is not in
       * the hit path. This is the one thing `Button` does not carry, and it is why the two were
       * decided separately rather than in one sweep.
       */
      sm: ["h-8", "gap-1.5", "px-2.5", "rounded-md", "has-[>svg]:px-2.5"],
      "icon-sm": ["size-8", "p-0", "has-[>svg]:p-0"],
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

interface InputGroupButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "size">,
    VariantProps<typeof inputGroupButtonVariants> {}

export const InputGroupButton = (props: InputGroupButtonProps) => {
  const {
    className,
    type = "button",
    variant = "ghost",
    size = "sm",
    slot,
    ...rest
  } = props;

  return (
    <Button
      className={cn(inputGroupButtonVariants({ size }), className)}
      data-size={size}
      type={type}
      variant={variant}
      {...rest}
      slot={slot ?? "input-group-button"}
    />
  );
};

export const InputGroupText = (
  props: React.ComponentProps<typeof ark.span>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      className={cn(
        "flex items-center gap-2",
        "text-muted-foreground text-sm",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "input-group-text"}
    />
  );
};

export const InputGroupInput = (props: React.ComponentProps<typeof Input>) => {
  const { className, slot, ...rest } = props;

  return (
    <Input
      className={cn(
        "flex-1",
        "bg-transparent",
        "rounded-none border-0 shadow-none",
        "focus-visible:ring-0",
        "disabled:bg-transparent aria-invalid:ring-0 data-invalid:ring-0",
                className
      )}
      {...rest}
      slot={slot ?? "input-group-control"}
    />
  );
};

export const InputGroupTextarea = (
  props: React.ComponentProps<typeof Textarea>
) => {
  const { className, slot, ...rest } = props;

  return (
    <Textarea
      className={cn(
        "flex-1",
        "py-3",
        "bg-transparent",
        "resize-none rounded-none border-0 shadow-none",
        "focus-visible:ring-0",
        "disabled:bg-transparent aria-invalid:ring-0 data-invalid:ring-0",
                className
      )}
      {...rest}
      slot={slot ?? "input-group-control"}
    />
  );
};
