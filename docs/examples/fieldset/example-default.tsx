import {
  Field,
  FieldLabel,
  Fieldset,
  FieldsetHelperText,
  FieldsetLegend,
  TextField,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Fieldset className="w-80">
      <FieldsetLegend>Billing address</FieldsetLegend>

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

      <FieldsetHelperText>Used for invoicing only.</FieldsetHelperText>
    </Fieldset>
  );
}
