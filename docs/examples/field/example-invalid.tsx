import { Field, FieldError, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80" invalid>
      <FieldLabel>Dataset name</FieldLabel>
      <Input defaultValue="My Dataset" />
      <FieldError>Names cannot contain spaces or capitals.</FieldError>
    </Field>
  );
}
