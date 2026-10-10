import {
  ScrollArea as ArkScrollArea,
  useScrollAreaContext,
} from "@ark-ui/react/scroll-area";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export const useScrollArea = useScrollAreaContext;

const scrollAreaVariants = tv({
  base: [
    "h-full",
    "rounded-[inherit]",
    "outline-none",
    "scrollbar-none",
    "outline-none",
  ],
  variants: {
    scrollFade: {
      true: [
        "mask-t-from-[calc(100%-var(--fade-size))]",
        "mask-b-from-[calc(100%-var(--fade-size))]",
        "data-at-top:mask-t-from-100%",
        "data-at-bottom:mask-b-from-100%",
        "transition-shadow",
        "motion-reduce:transition-none!",
      ],
    },
  },
  defaultVariants: {
    scrollFade: false,
  },
});

interface ScrollAreaProps
  extends React.ComponentProps<typeof ArkScrollArea.Root>,
    VariantProps<typeof scrollAreaVariants> {
  /**
   * Which axes scroll. `both` is Ark's area as it ships; `vertical` is a column whose width is its
   * parent's and never its content's.
   *
   * **Why `vertical` exists:** Ark gives the content `min-width: fit-content`, so one line that does
   * not wrap — an IRI, a nowrap label — sets the whole column's width, and the panel around it grows
   * or scrolls sideways. Measured 2026-10-02 on the findings example: rows ran past a 448 px popover
   * to 507 px behind a horizontal scrollbar. `vertical` sets the content's floor to 0, hides the
   * viewport's x overflow and draws no horizontal scrollbar, so what is too wide wraps or is cut by
   * its own rule. It is not the default because a code block or a wide table in a dialog relies on
   * the sideways scroll; what would reverse that is every call site passing `vertical`.
   *
   * @default "both"
   */
  orientation?: "both" | "vertical";
}

export const ScrollArea = (props: ScrollAreaProps) => {
  const {
    scrollFade = false,
    orientation = "both",
    className,
    children,
    slot,
    ...rest
  } = props;
  const vertical = orientation === "vertical";

  return (
    <ArkScrollArea.Root
      className={cn("size-full min-h-0 [--fade-size:1.5rem]", className)}
      data-orientation={orientation}
      {...rest}
      data-slot={slot ?? "scroll-area"}
    >
      <ArkScrollArea.Viewport
        className={cn(scrollAreaVariants({ scrollFade }))}
        data-slot="scroll-area-viewport"
        // Ark's own `overflow: auto` is inline, so only an inline style outranks it.
        style={vertical ? { overflowX: "hidden", overflowY: "auto" } : undefined}
      >
        <ArkScrollArea.Content
          data-slot="scroll-area-content"
          style={vertical ? { minWidth: 0 } : undefined}
        >
          {children}
        </ArkScrollArea.Content>
      </ArkScrollArea.Viewport>

      <ScrollAreaScrollbar orientation="vertical" />
      {vertical ? null : <ScrollAreaScrollbar orientation="horizontal" />}

      <ArkScrollArea.Corner data-slot="scroll-area-corner" />
    </ArkScrollArea.Root>
  );
};

export const ScrollAreaScrollbar = (
  props: React.ComponentProps<typeof ArkScrollArea.Scrollbar>
) => {
  const { orientation, className, slot, ...rest } = props;

  return (
    <ArkScrollArea.Scrollbar
      className={cn(
        "flex",
        "m-1",
        "bg-transparent",
        "opacity-0 transition-opacity delay-300",
        "data-[orientation=vertical]:w-1.5",
        "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:flex-col",
        "data-hover:opacity-100 data-hover:delay-0 data-hover:duration-100",
        "data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-100",
        "data-[orientation=vertical]:in-[[data-slot=scroll-area]:not([data-overflow-y])]:hidden",
        "data-[orientation=horizontal]:in-[[data-slot=scroll-area]:not([data-overflow-x])]:hidden",
        "motion-reduce:transition-none!",
        className
      )}
      orientation={orientation}
      {...rest}
      data-slot={slot ?? "scroll-area-scrollbar"}
    >
      {/* The thumb is the whole control — the track is `bg-transparent` — so its fill is the
          visual information that identifies it, at 3:1. Diluted it measured 1.55:1 on the light
          page and 1.69–1.78 on the dark surfaces; `--input`, the boundary role, gives 4.54 and
          3.89–4.18. A fill by spelling, a boundary by duty, like a switch's unchecked track. */}
      <ArkScrollArea.Thumb
        className="relative flex-1 rounded-full bg-input"
        data-slot="scroll-area-thumb"
      />
    </ArkScrollArea.Scrollbar>
  );
};
