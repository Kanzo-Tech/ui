"use client";

import {
  PasswordInput as ArkPasswordInput,
  usePasswordInputContext,
} from "@ark-ui/react/password-input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  type InputGroupProps,
} from "./input-group";

export const usePasswordInput = usePasswordInputContext;

interface PasswordInputProps
  extends React.ComponentProps<typeof ArkPasswordInput.Root>,
    Pick<InputGroupProps, "size"> {}

export const PasswordInput = (props: PasswordInputProps) => {
  const { size = "md", className, ...rest } = props;

  return (
    <ArkPasswordInput.Root
      className={cn(
        "group/password-input",
        "w-full",
        "flex flex-col items-start gap-2",
        className
      )}
      data-size={size}
      data-slot="password-input"
      {...rest}
    />
  );
};

export const PasswordInputGroup = (
  props: React.ComponentProps<typeof ArkPasswordInput.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkPasswordInput.Control asChild data-slot="password-input-control">
      <InputGroup
        className={cn(
          "in-data-[size=lg]:h-9 in-data-[size=sm]:h-7",
          "data-disabled:pointer-events-none data-disabled:opacity-64",
          className
        )}
        {...rest}
      />
    </ArkPasswordInput.Control>
  );
};

export interface PasswordInputInputProps
  extends React.ComponentProps<typeof ArkPasswordInput.Input> {
  /**
   * A secret already exists on the server. The field still renders EMPTY — submitting it empty
   * means "keep the stored value". This is the canonical credential-editing shape: the secret
   * is never sent to the client, so there is nothing to prefill. Opt-in.
   */
  hasStoredValue?: boolean;
  /** Placeholder shown while a stored secret is untouched. */
  storedPlaceholder?: string;
}

export const PasswordInputInput = (props: PasswordInputInputProps) => {
  const {
    hasStoredValue = false,
    storedPlaceholder = "Leave empty to keep current",
    placeholder,
    value,
    defaultValue,
    ...rest
  } = props;

  // The stored-value hint only makes sense while the field is untouched; once the user types,
  // the submitted value replaces the secret and the hint would be a lie.
  const untouched = !value && !defaultValue;
  const shown = hasStoredValue && untouched ? storedPlaceholder : placeholder;

  return (
    <ArkPasswordInput.Input
      asChild
      data-has-stored-value={hasStoredValue || undefined}
      data-slot="password-input-input"
      defaultValue={defaultValue}
      placeholder={shown}
      value={value}
      {...rest}
    >
      <InputGroupInput />
    </ArkPasswordInput.Input>
  );
};

export const PasswordInputTrigger = (
  props: React.ComponentProps<typeof ArkPasswordInput.VisibilityTrigger>
) => {
  const { children, ...rest } = props;

  return (
    <InputGroupAddon align="inline-end">
      <ArkPasswordInput.VisibilityTrigger
        asChild
        data-slot="password-input-visibility-trigger"
      >
        <InputGroupButton size="icon-xs" variant="ghost" {...rest}>
          {children ?? <PasswordInputIndicator />}
        </InputGroupButton>
      </ArkPasswordInput.VisibilityTrigger>
    </InputGroupAddon>
  );
};

export const PasswordInputIndicator = (
  props: React.ComponentProps<typeof ArkPasswordInput.Indicator>
) => {
  const { children, ...rest } = props;

  return (
    <ArkPasswordInput.Indicator
      data-slot="password-input-indicator"
      fallback={<EyeOffIcon />}
      {...rest}
    >
      {children ?? <EyeIcon />}
    </ArkPasswordInput.Indicator>
  );
};
