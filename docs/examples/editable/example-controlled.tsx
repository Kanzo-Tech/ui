"use client";

import {
  Button,
  Card,
  CardAction,
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
import { CheckIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

export default function Example() {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("A wyrm under the granary");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader description="The whole card enters edit mode at once." title="Edit contract">
        <CardAction>
          <Button onClick={() => setEditing((e) => !e)} variant={editing ? "outline" : "ghost"}>
            {editing ? (
              <>
                <CheckIcon /> Save
              </>
            ) : (
              <>
                <PencilIcon /> Edit
              </>
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Contract title</FieldLabel>
            <Editable
              activationMode="none"
              edit={editing}
              onValueChange={(d) => setTitle(d.value)}
              value={title}
            >
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
            <Editable activationMode="none" defaultValue="Hearthward Mill" edit={editing}>
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
