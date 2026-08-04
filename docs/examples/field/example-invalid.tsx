import { Field, FieldError, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80" invalid>
      <FieldLabel>Contract id</FieldLabel>
      <Input defaultValue="Q 1041" />
      <FieldError>Contract ids are Q- followed by four figures.</FieldError>
    </Field>
  );
}
