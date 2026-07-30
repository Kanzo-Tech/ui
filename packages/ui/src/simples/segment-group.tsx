import {
  SegmentGroup as ArkSegmentGroup,
  useSegmentGroupContext,
} from "@ark-ui/react/segment-group";
import type React from "react";
import { cn } from "../lib/cn";

export const useSegmentGroup = useSegmentGroupContext;

type SegmentGroupVariant = "default" | "underline" | "solid";

export interface SegmentGroupOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SegmentGroupProps
  extends React.ComponentProps<typeof ArkSegmentGroup.Root> {
  /**
   * The visual variant of the segment group.
   *
   * @default "default"
   */
  variant?: SegmentGroupVariant;
  /** Data-driven items rendered before `children` (additive with the compound API). */
  options?: readonly SegmentGroupOption[];
  /** Extra classes applied to each `options`-rendered item. */
  itemClassName?: string;
}

export const SegmentGroup = (props: SegmentGroupProps) => {
  const {
    orientation = "horizontal",
    variant = "default",
    options,
    itemClassName,
    className,
    children,
    ...rest
  } = props;

  return (
    <ArkSegmentGroup.Root
      className={cn(
        "group/segment-group relative",
        "flex gap-2",
        "isolate",
        "data-[orientation=vertical]:flex-col",
        "data-disabled:opacity-64",
        "data-[variant=underline]:gap-1 data-[variant=underline]:border-input",
        "data-[orientation=horizontal]:data-[variant=underline]:border-b",
        "data-[orientation=vertical]:data-[variant=underline]:border-l",
        // `solid`: a filled `bg-muted` track with equal-width segments — the contained
        // "segmented control" look, so consumers stop hand-rolling the track each time.
        // The track border is solid: diluted, it composited to ramp step 5 on every backdrop
        // (ΔE 0.00–1.65), and step 5 is `--accent`. `--border` moved from 5 to 6 precisely so a
        // border and a hover surface would stop being the same colour.
        "data-[variant=solid]:rounded-lg data-[variant=solid]:border data-[variant=solid]:border-border data-[variant=solid]:bg-muted data-[variant=solid]:p-1",
        className
      )}
      data-slot="segment-group"
      data-variant={variant}
      orientation={orientation}
      {...rest}
    >
      <SegmentGroupIndicator />

      {options?.map((o) => (
        <SegmentGroupItem
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn("px-3 py-1.5", itemClassName)}
        >
          <SegmentGroupItemText className="flex items-center justify-center gap-2 text-sm font-medium">
            {o.label}
          </SegmentGroupItemText>
        </SegmentGroupItem>
      ))}

      {children}
    </ArkSegmentGroup.Root>
  );
};

export const SegmentGroupItem = (
  props: React.ComponentProps<typeof ArkSegmentGroup.Item>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkSegmentGroup.Item
      className={cn(
        "relative z-1",
        "inline-flex items-center justify-center",
        "cursor-pointer select-none",
        "text-sm font-medium text-muted-foreground transition-colors",
        "hover:text-foreground data-[state=checked]:text-foreground",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        "group-data-[variant=solid]/segment-group:flex-1 group-data-[variant=solid]/segment-group:justify-center",
        "rounded-[inherit] border border-transparent",
        "outline-none data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      data-slot="segment-group-item"
      {...rest}
    >
      {children}

      <ArkSegmentGroup.ItemControl />
      <ArkSegmentGroup.ItemHiddenInput />
    </ArkSegmentGroup.Item>
  );
};

export const SegmentGroupItemText = (
  props: React.ComponentProps<typeof ArkSegmentGroup.ItemText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkSegmentGroup.ItemText
      className={cn("relative z-1", className)}
      data-slot="segment-group-item-text"
      {...rest}
    />
  );
};

export const SegmentGroupIndicator = (
  props: React.ComponentProps<typeof ArkSegmentGroup.Indicator>
) => {
  const { className, ...rest } = props;

  return (
    <ArkSegmentGroup.Indicator
      className={cn(
        "absolute top-(--top) left-(--left) z-0",
        "h-(--height) w-(--width)",
        "rounded-[inherit]",
        // The moving "pill": an elevated surface with a hairline border and a soft shadow, so
        // the selected segment reads as a raised chip on the muted track (crisp, not flat).
        // Solid for the same reason as the track — diluted it landed on step 5, `--accent`.
        "border border-border bg-background shadow-sm",
        "transition-[width,height,left,top] duration-150 ease-out",
        "[transition-property:var(--transition-property,width,height,left,top)]",
        // `underline` is a bar, not a pill: drop the chrome and paint the accent.
        "group-data-[variant=underline]/segment-group:border-transparent group-data-[variant=underline]/segment-group:bg-primary group-data-[variant=underline]/segment-group:shadow-none",
        "data-[orientation=horizontal]:group-data-[variant=underline]/segment-group:top-[calc(var(--top)+var(--height)-1px)]",
        "data-[orientation=vertical]:group-data-[variant=underline]/segment-group:right-[calc(var(--left)+var(--width)-1px)]",
        "data-[orientation=vertical]:group-data-[variant=underline]/segment-group:-translate-x-px",
        "data-[orientation=horizontal]:group-data-[variant=underline]/segment-group:h-0.5",
        "data-[orientation=vertical]:group-data-[variant=underline]/segment-group:w-0.5",
        "motion-reduce:transition-none!",
        className
      )}
      data-slot="segment-group-indicator"
      {...rest}
    />
  );
};
