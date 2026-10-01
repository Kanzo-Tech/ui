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
  Textarea,
} from "@kanzo-tech/ui";
import { CheckIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Editable
      className="w-full max-w-64"
      defaultValue="Grade 3, pays in salt"
      orientation="vertical"
    >
      <EditableArea>
        <EditableInput asChild>
          <Textarea className="min-h-24" />
        </EditableInput>
        <EditablePreview className="min-h-24" />
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
