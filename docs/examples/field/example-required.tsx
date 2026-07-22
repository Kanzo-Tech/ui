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
        Dataset name
        <FieldRequiredIndicator />
      </FieldLabel>
      <Input placeholder="customers" />
    </Field>
  );
}
