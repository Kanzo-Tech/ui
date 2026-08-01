import { Field, FieldError, FieldLabel, Input } from "@kanzo-tech/ui";

/** The four root states, side by side. Each is one prop on the Field — never on the control. */
export default function Example() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Field>
        <FieldLabel>Default</FieldLabel>
        <Input placeholder="A wyrm under the granary" />
      </Field>

      <Field invalid>
        <FieldLabel>Invalid</FieldLabel>
        <Input defaultValue="Q 1041" />
        <FieldError>Contract ids are Q- followed by four figures.</FieldError>
      </Field>

      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <Input defaultValue="Q-1041" />
      </Field>

      <Field readOnly>
        <FieldLabel>Read only</FieldLabel>
        <Input defaultValue="The Amber Hall" />
      </Field>
    </div>
  );
}
