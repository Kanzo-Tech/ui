import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
} from "@kanzo-tech/ui";

/** Everything the Field pattern gives you, in one field: association, required indicator,
 *  description and an error that renders only because the root says `invalid`. */
export default function Example() {
  return (
    <div className="w-full max-w-sm">
      <Field invalid required>
        <FieldLabel>
          Dataset name
          <FieldRequiredIndicator />
        </FieldLabel>
        <Input defaultValue="air quality 2024" />
        <FieldDescription>Lowercase letters, numbers and hyphens.</FieldDescription>
        <FieldError>Names cannot contain spaces.</FieldError>
      </Field>
    </div>
  );
}
