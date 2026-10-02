"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from "@kanzo-tech/ui";
import { CheckIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader
        description="Click the text to start editing."
        title="Edit with click"
      />
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Contract title</FieldLabel>
            <Editable activationMode="click" defaultValue="A wyrm under the granary">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
              <EditableControl>
                <EditableCancelTrigger asChild>
                  <Button aria-label="Cancel" size="icon-md" variant="outline">
                    <XIcon />
                  </Button>
                </EditableCancelTrigger>
                <EditableSubmitTrigger asChild>
                  <Button aria-label="Save" size="icon-md" variant="outline">
                    <CheckIcon />
                  </Button>
                </EditableSubmitTrigger>
              </EditableControl>
            </Editable>
          </Field>
          <Field>
            <FieldLabel>Posted by</FieldLabel>
            <Editable activationMode="click" defaultValue="Hearthward Mill">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
              <EditableControl>
                <EditableCancelTrigger asChild>
                  <Button aria-label="Cancel" size="icon-md" variant="outline">
                    <XIcon />
                  </Button>
                </EditableCancelTrigger>
                <EditableSubmitTrigger asChild>
                  <Button aria-label="Save" size="icon-md" variant="outline">
                    <CheckIcon />
                  </Button>
                </EditableSubmitTrigger>
              </EditableControl>
            </Editable>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
