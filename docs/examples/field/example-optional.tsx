import {
  Field,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80">
      <FieldLabel>
        Patron
        <FieldRequiredIndicator fallback="(optional)" />
      </FieldLabel>
      <Input placeholder="The miller's widow" />
    </Field>
  );
}
