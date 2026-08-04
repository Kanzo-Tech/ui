import {
  Progress as ArkProgress,
  useProgressContext,
} from "@ark-ui/react/progress";
import type React from "react";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

export const useProgress = useProgressContext;

interface ProgressProps
  extends Omit<React.ComponentProps<typeof ArkProgress.Root>, "value"> {
  /**
   * Shows indeterminate progress
   *
   * @default false
   */
  indeterminate?: boolean;
  /**
   * The value of the progress bar
   *
   * @default 0
   */
  value?: number;
}

export const Progress = (props: ProgressProps) => {
  const {
    value,
    orientation = "horizontal",
    indeterminate = false,
    className,
    children,
    slot,
    ...rest
  } = props;

  return (
    <ArkProgress.Root
      className={cn(
        "flex flex-wrap gap-3",
        "data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:-scale-y-100",
        className
      )}
      orientation={orientation}
      value={indeterminate ? null : value}
      {...rest}
      data-slot={slot ?? "progress"}
    >
      {children}

      <ProgressTrack>
        <ProgressRange />
      </ProgressTrack>
    </ArkProgress.Root>
  );
};

export const ProgressTrack = (
  { slot, ...rest }: React.ComponentProps<typeof ArkProgress.Track>
) => (
  <ArkProgress.Track
    className={cn(
      "bg-border",
      "rounded-full",
      "overflow-x-hidden",
      "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full",
      "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
    )}
    {...rest}
    data-slot={slot ?? "progress-track"}
  />
);

export const ProgressRange = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkProgress.Range>) => (
  <ArkProgress.Range
    className={cn(
      "bg-primary",
      "transition-all duration-300 ease-out",
      "data-[orientation=horizontal]:h-full",
      "data-[orientation=vertical]:h-full",
      "motion-reduce:animate-none! motion-reduce:transition-none!",
      "data-[state=indeterminate]:w-1/3 data-[state=indeterminate]:animate-indeterminate! data-[state=indeterminate]:duration-100"
    )}
    {...rest}
    data-slot={slot ?? "progress-range"}
  />
);

export const ProgressValue = (
  props: React.ComponentProps<typeof ArkProgress.ValueText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkProgress.ValueText
        className={cn("ms-auto tabular-nums", className)}
        {...rest}
        data-slot={slot ?? "progress-value"}
      />
    </FieldLabel>
  );
};
