import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <PasswordInput key={size} size={size}>
          <PasswordInputGroup>
            <PasswordInputInput placeholder={size} />
            <PasswordInputTrigger />
          </PasswordInputGroup>
        </PasswordInput>
      ))}
    </div>
  );
}
