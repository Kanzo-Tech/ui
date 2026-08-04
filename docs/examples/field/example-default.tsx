import { Field, FieldDescription, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80">
      <FieldLabel>Contract title</FieldLabel>
      <Input placeholder="A wyrm under the granary" />
      <FieldDescription>
        One line — it is what the board shows and what a party quotes back.
      </FieldDescription>
    </Field>
  );
}
