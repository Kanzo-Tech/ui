import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-72">
      <PasswordInput autoComplete="new-password">
        <PasswordInputGroup>
          {/* A secret already lives on the server, so the field renders empty: submitting it
              empty means "keep the stored value". The hint disappears the moment you type. */}
          <PasswordInputInput hasStoredValue />
          <PasswordInputTrigger />
        </PasswordInputGroup>
      </PasswordInput>
    </div>
  );
}
