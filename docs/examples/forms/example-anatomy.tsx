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
          Contract title
          <FieldRequiredIndicator />
        </FieldLabel>
        <Input defaultValue="wyrm" />
        <FieldDescription>What the board shows, in one line.</FieldDescription>
        <FieldError>Give the contract a title a poster would recognise.</FieldError>
      </Field>
    </div>
  );
}
