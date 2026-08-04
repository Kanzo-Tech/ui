import { Field, FieldHelper, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80" disabled>
      <FieldLabel>Contract id</FieldLabel>
      <Input defaultValue="Q-1041" />
      <FieldHelper>Assigned when the contract is posted, and never reused.</FieldHelper>
    </Field>
  );
}
