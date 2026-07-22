"use client";

import type { ChangeEvent, Ref } from "react";
import { cn } from "../lib/cn.js";
import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "./password-input.js";

export interface SecretFieldProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * A secret already exists on the server. The field still renders EMPTY — submitting it
   * empty means "keep the stored value". This is the canonical credential-editing shape:
   * the secret is never sent to the client, so there is nothing to prefill.
   */
  hasStoredValue?: boolean;
  /** Placeholder shown while a stored secret is untouched. */
  storedPlaceholder?: string;
  placeholder?: string;
  /** Show the reveal (eye) toggle. Default true. */
  revealable?: boolean;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  readOnly?: boolean;
  name?: string;
  id?: string;
  /** Default "current-password"; use "new-password" to suppress autofill of an old value. */
  autoComplete?: "current-password" | "new-password";
  /**
   * Keep password managers away from the field. Correct for API keys and tokens, which
   * are not passwords and should not land in a vault prompt.
   */
  ignorePasswordManagers?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A masked credential input with the "empty means keep the current value" semantics that
 * every credential-editing form needs. Built on Ark's PasswordInput, so the reveal toggle,
 * its aria-label and the disabled/invalid propagation come from the machine.
 */
export function SecretField({
  value,
  defaultValue,
  onValueChange,
  hasStoredValue = false,
  storedPlaceholder = "Leave empty to keep current",
  placeholder,
  revealable = true,
  size = "md",
  disabled,
  invalid,
  required,
  readOnly,
  name,
  id,
  autoComplete,
  ignorePasswordManagers,
  className,
  ref,
}: SecretFieldProps) {
  // The stored-value hint only makes sense while the field is untouched; once the user
  // types, the submitted value replaces the secret and the hint would be a lie.
  const untouched = !value && !defaultValue;
  const shown = hasStoredValue && untouched ? storedPlaceholder : placeholder;

  return (
    <PasswordInput
      autoComplete={autoComplete}
      className={cn("gap-0", className)}
      data-has-stored-value={hasStoredValue ? "" : undefined}
      disabled={disabled}
      ignorePasswordManagers={ignorePasswordManagers}
      invalid={invalid}
      name={name}
      readOnly={readOnly}
      required={required}
      size={size}
    >
      <PasswordInputGroup>
        <PasswordInputInput
          defaultValue={defaultValue}
          id={id}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onValueChange?.(event.target.value)
          }
          placeholder={shown}
          ref={ref}
          value={value}
        />
        {revealable && <PasswordInputTrigger />}
      </PasswordInputGroup>
    </PasswordInput>
  );
}
SecretField.displayName = "SecretField";
