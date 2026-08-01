import { Field, FieldDescription, FieldLabel, Textarea } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-96">
      <FieldLabel>The work</FieldLabel>
      <Textarea placeholder="What does the contract ask for?" />
      <FieldDescription>
        An archivist reads this before anyone signs it.
      </FieldDescription>
    </Field>
  );
}
