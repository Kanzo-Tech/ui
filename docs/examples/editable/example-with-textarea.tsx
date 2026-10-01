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
  Textarea,
} from "@kanzo-tech/ui";
import { CheckIcon, XIcon } from "lucide-react";

export default function Example() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader description="Over a textarea the preview wraps instead of truncating." title="Edit briefing" />
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Briefing</FieldLabel>
            <Editable
              defaultValue="Something has been taking a sack a night from the Hearthward granary. The miller heard wings. Bring salt."
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
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
