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
    <Editable className="w-full max-w-64" defaultValue="A wyrm under the granary">
      <EditableArea>
        <EditableInput asChild>
          <Input size="lg" />
        </EditableInput>
        <EditablePreview size="lg" />
      </EditableArea>
      <EditableControl>
        <EditableCancelTrigger asChild>
          <Button aria-label="Cancel" size="icon-lg" variant="outline">
            <XIcon />
          </Button>
        </EditableCancelTrigger>
        <EditableSubmitTrigger asChild>
          <Button aria-label="Save" size="icon-lg" variant="outline">
            <CheckIcon />
          </Button>
        </EditableSubmitTrigger>
      </EditableControl>
    </Editable>
  );
}
