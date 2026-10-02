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
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from "@kanzo-tech/ui";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader
        description="Only the pencil starts editing."
        title="Edit with a trigger"
      />
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Contract title</FieldLabel>
            <Editable activationMode="none" defaultValue="A wyrm under the granary">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
              <EditableControl>
                <EditableEditTrigger asChild>
                  <Button aria-label="Edit" size="icon-md" variant="outline">
                    <PencilIcon />
                  </Button>
                </EditableEditTrigger>
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
            <Editable activationMode="none" defaultValue="Hearthward Mill">
              <EditableArea>
                <EditableInput asChild>
                  <Input />
                </EditableInput>
                <EditablePreview />
              </EditableArea>
              <EditableControl>
                <EditableEditTrigger asChild>
                  <Button aria-label="Edit" size="icon-md" variant="outline">
                    <PencilIcon />
                  </Button>
                </EditableEditTrigger>
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
