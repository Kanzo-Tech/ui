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
  Input,
} from "@kanzo-tech/ui";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <div className="flex h-12 w-full max-w-sm items-center gap-2 rounded-lg border px-3">
      <span className="shrink-0 text-muted-foreground text-sm">Jobs /</span>
      <Editable
        activationMode="dblclick"
        className="w-auto max-w-56"
        defaultValue="Every sighting along the northern road, by hall and grade"
        placeholder="Unnamed job"
        submitMode="both"
      >
        <EditableArea className="w-auto">
          <EditableInput asChild>
            <Input size="sm" />
          </EditableInput>
          <EditablePreview size="sm" variant="ghost" />
        </EditableArea>
        <EditableControl>
          <EditableEditTrigger asChild>
            <Button aria-label="Rename" size="icon-sm" variant="ghost">
              <PencilIcon />
            </Button>
          </EditableEditTrigger>
          <EditableSubmitTrigger asChild>
            <Button aria-label="Save" size="icon-sm" variant="ghost">
              <CheckIcon />
            </Button>
          </EditableSubmitTrigger>
          <EditableCancelTrigger asChild>
            <Button aria-label="Cancel" size="icon-sm" variant="ghost">
              <XIcon />
            </Button>
          </EditableCancelTrigger>
        </EditableControl>
      </Editable>
    </div>
  );
}
