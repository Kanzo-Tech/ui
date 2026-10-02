"use client";

import {
  Editable,
  EditableArea,
  EditableInput,
  EditablePreview,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
} from "@kanzo-tech/ui";

const MODES = [
  { mode: "both", hint: "Enter or clicking away saves." },
  { mode: "enter", hint: "Only Enter saves; clicking away reverts." },
  { mode: "blur", hint: "Only clicking away saves; Enter does nothing." },
] as const;

export default function Example() {
  return (
    <FieldGroup className="w-full max-w-sm">
      {MODES.map(({ mode, hint }) => (
        <Field key={mode}>
          <FieldLabel>submitMode="{mode}"</FieldLabel>
          <Editable activationMode="click" defaultValue="A wyrm under the granary" submitMode={mode}>
            <EditableArea>
              <EditableInput asChild>
                <Input />
              </EditableInput>
              <EditablePreview />
            </EditableArea>
          </Editable>
          <FieldDescription>{hint}</FieldDescription>
        </Field>
      ))}
    </FieldGroup>
  );
}
