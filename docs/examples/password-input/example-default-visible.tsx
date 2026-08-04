import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <PasswordInput autoComplete="new-password" className="w-72" defaultVisible>
      <PasswordInputGroup>
        <PasswordInputInput defaultValue="nothing keeps forever" />
        <PasswordInputTrigger />
      </PasswordInputGroup>
    </PasswordInput>
  );
}
