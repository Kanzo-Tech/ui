import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSetError,
  FieldSetHelper,
  TextField,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <FieldSet className="w-80" invalid>
      <FieldLegend variant="label">Billing address</FieldLegend>

      <Field>
        <FieldLabel>Street</FieldLabel>
        <TextField placeholder="123 Main St" />
      </Field>
      <Field>
        <FieldLabel>City</FieldLabel>
        <TextField placeholder="Springfield" />
      </Field>
      <Field>
        <FieldLabel>Postal code</FieldLabel>
        <TextField placeholder="90210" />
      </Field>

      <FieldSetHelper>Used for invoicing only.</FieldSetHelper>
      <FieldSetError>Address is incomplete.</FieldSetError>
    </FieldSet>
  );
}
