import { Checkbox, Field, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-6">
      <Field>
        <FieldLabel>Contract title</FieldLabel>
        <Input placeholder="A wyrm under the granary" />
      </Field>

      <Field orientation="horizontal">
        <Checkbox defaultChecked />
        <FieldLabel>Post to every hall</FieldLabel>
      </Field>
    </div>
  );
}
