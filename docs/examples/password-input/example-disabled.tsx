import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <PasswordInput className="w-72" disabled>
      <PasswordInputGroup>
        <PasswordInputInput defaultValue="hunter2" />
        <PasswordInputTrigger />
      </PasswordInputGroup>
    </PasswordInput>
  );
}
