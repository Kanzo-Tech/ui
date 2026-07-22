import { Field, FieldHelper, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80" disabled>
      <FieldLabel>Graph id</FieldLabel>
      <Input defaultValue="urn:kanzo:customers" />
      <FieldHelper>Assigned on creation and immutable.</FieldHelper>
    </Field>
  );
}
