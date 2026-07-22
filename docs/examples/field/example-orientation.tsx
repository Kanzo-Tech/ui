import { Checkbox, Field, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-6">
      <Field>
        <FieldLabel>Vertical</FieldLabel>
        <Input placeholder="Label above the control" />
      </Field>

      <Field orientation="horizontal">
        <Checkbox defaultChecked />
        <FieldLabel>Horizontal — control first</FieldLabel>
      </Field>
    </div>
  );
}
