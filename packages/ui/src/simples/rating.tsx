"use client";

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
  const { className, children, ...rest } = props;

  return (
    <ArkRatingGroup.Root
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      data-slot="rating"
      {...rest}
    >
      {children}
    </ArkRatingGroup.Root>
  );
};

export const RatingLabel = (
  props: React.ComponentProps<typeof ArkRatingGroup.Label>
) => {
  const { children, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkRatingGroup.Label data-slot="rating-label" {...rest}>
        {children}
      </ArkRatingGroup.Label>
    </FieldLabel>
  );
};

export const RatingControl = (
  props: React.ComponentProps<typeof ArkRatingGroup.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkRatingGroup.Control
      className={cn(
        "inline-flex items-center gap-0.5",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      data-slot="rating-control"
      {...rest}
    />
  );
};

export const RatingItem = (
  props: React.ComponentProps<typeof ArkRatingGroup.Item>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkRatingGroup.Item
      className={cn(
        "group/rating-item relative",
        "cursor-pointer",
        "rounded-sm",
        "outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/32",
        "data-readonly:cursor-default",
        "data-disabled:cursor-default",
        className
      )}
      data-slot="rating-item"
      {...rest}
    >
      {children ?? (
        <>
          <StarIcon
            aria-hidden
            className="size-5 text-muted-foreground/40"
          />
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
  props: React.ComponentProps<typeof ArkRatingGroup.HiddenInput>
) => {
  return <ArkRatingGroup.HiddenInput {...props} />;
};
