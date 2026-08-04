import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <PasswordInput className="w-72">
      <PasswordInputGroup>
        <PasswordInputInput placeholder="Hall password" />
        <PasswordInputTrigger />
      </PasswordInputGroup>
    </PasswordInput>
  );
}
