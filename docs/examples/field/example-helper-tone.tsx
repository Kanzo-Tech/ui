import { Field, FieldDescription, FieldHelper, FieldLabel, Input } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-6">
      <Field>
        <FieldLabel>Delivery address</FieldLabel>
        <Input defaultValue="PO Box 1041" />
        <FieldHelper tone="warning">Couriers cannot deliver to a P.O. box.</FieldHelper>
      </Field>

      <Field>
        <FieldLabel>Display name</FieldLabel>
        <FieldDescription>Shown to the people you share with.</FieldDescription>
        <Input defaultValue="Ravenna Sarkis" />
        <FieldHelper tone="info">Changing it does not rename past exports.</FieldHelper>
      </Field>
    </div>
  );
}
