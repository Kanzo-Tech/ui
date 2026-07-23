"use client";

import {
  Fieldset as ArkFieldset,
  useFieldsetContext,
} from "@ark-ui/react/fieldset";
import type React from "react";
import { cn } from "../lib/cn";

export const useFieldset = useFieldsetContext;

export const Fieldset = (
  props: React.ComponentProps<typeof ArkFieldset.Root>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFieldset.Root
      className={cn(
        "flex flex-col gap-6",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      data-slot="fieldset"
      {...rest}
    />
  );
};

export const FieldsetLegend = (
  props: React.ComponentProps<typeof ArkFieldset.Legend>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFieldset.Legend
      className={cn("mb-3 font-medium text-sm leading-snug", className)}
      data-slot="fieldset-legend"
      {...rest}
    />
  );
};

export const FieldsetHelperText = (
  props: React.ComponentProps<typeof ArkFieldset.HelperText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFieldset.HelperText
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="fieldset-helper"
      {...rest}
    />
  );
};

export const FieldsetErrorText = (
  props: React.ComponentProps<typeof ArkFieldset.ErrorText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFieldset.ErrorText
      className={cn(
        "font-normal text-destructive text-sm",
        "dark:text-destructive-foreground",
        className
      )}
      data-slot="fieldset-error"
      {...rest}
    />
  );
};
