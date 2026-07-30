import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <FieldSet className="w-80">
      <FieldLegend>Posting</FieldLegend>
      <FieldDescription>Which hall signs the contract, and where the work is.</FieldDescription>

      <FieldGroup>
        <Field>
          <FieldLabel>Hall</FieldLabel>
          <Input placeholder="The Amber Hall" />
        </Field>
        <Field>
          <FieldLabel>Region</FieldLabel>
          <Input placeholder="Thornmarch" />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
