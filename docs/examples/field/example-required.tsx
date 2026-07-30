import {
  Field,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80" required>
      <FieldLabel>
        Contract title
        <FieldRequiredIndicator />
      </FieldLabel>
      <Input placeholder="A wyrm under the granary" />
    </Field>
  );
}
