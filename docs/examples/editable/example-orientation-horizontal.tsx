"use client";

import {
  Button,
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  Input,
} from "@kanzo-tech/ui";
import { CheckIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Editable
      className="w-full max-w-64"
      defaultValue="Grade 3, pays in salt"
      orientation="horizontal"
    >
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
  );
}
