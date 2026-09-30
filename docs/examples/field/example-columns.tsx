import { Field, FieldGroup, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <FieldGroup className="w-full max-w-xl sm:grid-cols-2" columns={1}>
      <Field>
        <FieldLabel>First name</FieldLabel>
        <Input defaultValue="Ravenna" />
      </Field>
      <Field>
        <FieldLabel>Last name</FieldLabel>
        <Input defaultValue="Sarkis" />
      </Field>
      <Field className="col-span-full">
        <FieldLabel>Street</FieldLabel>
        <Input defaultValue="14 Lower Ford Road" />
      </Field>
      <Field>
        <FieldLabel>Postcode</FieldLabel>
        <Input defaultValue="OX1 4AB" />
      </Field>
      <Field>
        <FieldLabel>City</FieldLabel>
        <Input defaultValue="Oxford" />
      </Field>
    </FieldGroup>
  );
}
