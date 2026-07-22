import { Field, FieldDescription, FieldLabel, Textarea } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-96">
      <FieldLabel>Description</FieldLabel>
      <Textarea placeholder="What is this dataset?" />
      <FieldDescription>Markdown is supported.</FieldDescription>
    </Field>
  );
}
