import { Field, FieldDescription, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80">
      <FieldLabel>Dataset name</FieldLabel>
      <Input placeholder="customers" />
      <FieldDescription>
        Lower-case, no spaces — it becomes the graph id.
      </FieldDescription>
    </Field>
  );
}
