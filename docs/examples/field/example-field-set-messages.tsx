import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSetError,
  FieldSetHelper,
  Input,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <FieldSet className="w-80" invalid>
      <FieldLegend variant="label">Muster point</FieldLegend>

      <Field>
        <FieldLabel>Region</FieldLabel>
        <Input placeholder="Greenhollow" />
      </Field>
      <Field>
        <FieldLabel>Landmark</FieldLabel>
        <Input placeholder="The lower ford" />
      </Field>
      <Field>
        <FieldLabel>Hour</FieldLabel>
        <Input placeholder="First light" />
      </Field>

      <FieldSetHelper>Where the party forms up before it walks.</FieldSetHelper>
      <FieldSetError>A party cannot be told to meet nowhere.</FieldSetError>
    </FieldSet>
  );
}
