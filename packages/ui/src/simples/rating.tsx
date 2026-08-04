import {
  RatingGroup as ArkRatingGroup,
  useRatingGroupContext,
} from "@ark-ui/react/rating-group";
import { StarIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

export const useRating = useRatingGroupContext;

// Render-prop context used to map the machine's items into styled stars.
export const RatingContext = ArkRatingGroup.Context;

export const Rating = (
  props: React.ComponentProps<typeof ArkRatingGroup.Root>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkRatingGroup.Root
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "rating"}
    >
      {children}
    </ArkRatingGroup.Root>
  );
};

export const RatingLabel = (
  props: React.ComponentProps<typeof ArkRatingGroup.Label>
) => {
  const { children, slot, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkRatingGroup.Label {...rest} data-slot={slot ?? "rating-label"}>
        {children}
      </ArkRatingGroup.Label>
    </FieldLabel>
  );
};

export const RatingControl = (
  props: React.ComponentProps<typeof ArkRatingGroup.Control>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkRatingGroup.Control
      className={cn(
        "inline-flex items-center gap-0.5",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "rating-control"}
    />
  );
};

export const RatingItem = (
  props: React.ComponentProps<typeof ArkRatingGroup.Item>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkRatingGroup.Item
      className={cn(
        "group/rating-item relative",
        "cursor-pointer",
        "rounded-sm",
        "outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring",
        "data-readonly:cursor-default",
        "data-disabled:cursor-default",
        className
      )}
      {...rest}
      data-slot={slot ?? "rating-item"}
    >
      {children ?? (
        <>
          {/* The empty star is what says "out of five", so it owes the 3:1 that identifies a
              control's unfilled state. Diluted it measured 2.03:1 in light and 2.23 in dark.
              `--input` is the boundary role — the first ramp step that reaches 3:1 — and lands at
              4.54 and 4.18 while staying well under step 11, which at 9.19 would out-shout the
              filled stars (`--warning`, 3.07 in light). Same duty as a switch's unchecked track. */}
          <StarIcon aria-hidden className="size-5 text-input" />
          <StarIcon
            aria-hidden
            className={cn(
              "absolute inset-0 size-5",
              "fill-warning text-warning",
              "opacity-0 group-data-highlighted/rating-item:opacity-100",
              "group-data-half/rating-item:[clip-path:inset(0_50%_0_0)]"
            )}
          />
        </>
      )}
    </ArkRatingGroup.Item>
  );
};

export const RatingHiddenInput = (
  { slot, ...rest }: React.ComponentProps<typeof ArkRatingGroup.HiddenInput>
) => (
  <ArkRatingGroup.HiddenInput {...rest} data-slot={slot ?? "rating-hidden-input"} />
);
