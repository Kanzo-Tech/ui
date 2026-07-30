"use client";

import {
  Button,
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  Field,
  FieldLabel,
  Input,
} from "@kanzo-tech/ui";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Field className="w-full max-w-sm">
      <FieldLabel>Contract title</FieldLabel>
      <Editable
        activationMode="dblclick"
        defaultValue="A wyrm under the granary"
      >
        <EditableArea>
          <EditableInput asChild>
            <Input className="w-full" />
          </EditableInput>
          <EditablePreview />
        </EditableArea>
        <EditableControl>
          <EditableEditTrigger asChild>
            <Button aria-label="Edit" size="icon-md" variant="ghost">
              <PencilIcon />
            </Button>
          </EditableEditTrigger>
          <EditableSubmitTrigger asChild>
            <Button aria-label="Save" size="icon-md" variant="outline">
              <CheckIcon />
            </Button>
          </EditableSubmitTrigger>
          <EditableCancelTrigger asChild>
            <Button aria-label="Cancel" size="icon-md" variant="ghost">
              <XIcon />
            </Button>
          </EditableCancelTrigger>
        </EditableControl>
      </Editable>
    </Field>
  );
}
