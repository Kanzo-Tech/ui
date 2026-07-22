import { Field, FieldError, FieldLabel, Input } from "@kanzo-tech/ui";

/** The four root states, side by side. Each is one prop on the Field — never on the control. */
export default function Example() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Field>
        <FieldLabel>Default</FieldLabel>
        <Input placeholder="Nothing set" />
      </Field>

      <Field invalid>
        <FieldLabel>Invalid</FieldLabel>
        <Input defaultValue="not an endpoint" />
        <FieldError>Must be a valid URL.</FieldError>
      </Field>

      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <Input defaultValue="Locked" />
      </Field>

      <Field readOnly>
        <FieldLabel>Read only</FieldLabel>
        <Input defaultValue="Visible, not editable" />
      </Field>
    </div>
  );
}
