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
      <FieldLegend>Endpoint</FieldLegend>
      <FieldDescription>Where the graph is served from.</FieldDescription>

      <FieldGroup>
        <Field>
          <FieldLabel>Host</FieldLabel>
          <Input placeholder="api.example.com" />
        </Field>
        <Field>
          <FieldLabel>Path</FieldLabel>
          <Input placeholder="/sparql" />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
