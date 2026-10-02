"use client";

import {
  Card,
  CardContent,
  CardHeader,
  Editable,
  EditableArea,
  EditableInput,
  EditablePreview,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader
        description="Focus a field to edit; Enter saves, Escape cancels."
        title="Edit without controls"
      />
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Contract title</FieldLabel>
            <Editable defaultValue="A wyrm under the granary">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
            </Editable>
          </Field>
          <Field>
            <FieldLabel>Posted by</FieldLabel>
            <Editable defaultValue="Hearthward Mill">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
            </Editable>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
