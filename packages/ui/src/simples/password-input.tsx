import {
  PasswordInput as ArkPasswordInput,
  usePasswordInputContext,
} from "@ark-ui/react/password-input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { controlSizes } from "../lib/control-size";
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
  const { size = "md", className, slot, ...rest } = props;

  return (
    <ArkPasswordInput.Root
      className={cn(
        "group/password-input",
        "w-full",
        "flex flex-col items-start gap-2",
        controlSizes[size],
        className
      )}
      data-size={size}
      {...rest}
      data-slot={slot ?? "password-input"}
    />
  );
};

export const PasswordInputGroup = (
  props: React.ComponentProps<typeof ArkPasswordInput.Control>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkPasswordInput.Control asChild>
      <InputGroup
        className={cn(
          // The size is the root's, read through the custom property: a group would otherwise
          // assign its own default and the root's `size` would move nothing.
          "[--size:inherit]",
          "data-disabled:pointer-events-none data-disabled:opacity-64",
          className
        )}
        {...rest}
        slot={slot ?? "password-input-control"}
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
    slot,
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
      defaultValue={defaultValue}
      placeholder={shown}
      value={value}
      {...rest}
    >
      <InputGroupInput slot={slot ?? "password-input-input"} />
    </ArkPasswordInput.Input>
  );
};

export const PasswordInputTrigger = (
  props: React.ComponentProps<typeof ArkPasswordInput.VisibilityTrigger>
) => {
  const { children, slot, ...rest } = props;

  return (
    <InputGroupAddon align="inline-end">
      <ArkPasswordInput.VisibilityTrigger asChild>
        <InputGroupButton
          size="icon-sm"
          variant="ghost"
          {...rest}
          slot={slot ?? "password-input-visibility-trigger"}
        >
          {children ?? <PasswordInputIndicator />}
        </InputGroupButton>
      </ArkPasswordInput.VisibilityTrigger>
    </InputGroupAddon>
  );
};

export const PasswordInputIndicator = (
  props: React.ComponentProps<typeof ArkPasswordInput.Indicator>
) => {
  const { children, slot, ...rest } = props;

  return (
    <ArkPasswordInput.Indicator
      fallback={<EyeOffIcon />}
      {...rest}
      data-slot={slot ?? "password-input-indicator"}
    >
      {children ?? <EyeIcon />}
    </ArkPasswordInput.Indicator>
  );
};
