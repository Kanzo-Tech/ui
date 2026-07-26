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
  Field,
  FieldLabel,
  Input,
  Kbd,
  Show,
  useCompletion,
} from "@kanzo-tech/ui";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";

async function* complete(value: string, signal?: AbortSignal) {
  const rest = " (Spain, 2020–2023)";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 60));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [value, setValue] = useState("COVID-19 case registry");
  const completion = useCompletion({ complete });

  return (
    <Field className="w-full max-w-sm">
      <FieldLabel>Dataset name</FieldLabel>
      <Editable
        activationMode="click"
        onValueChange={(d) => {
          setValue(d.value);
          completion.setValue(d.value);
        }}
        placeholder="Name this dataset…"
        value={value}
      >
        <EditableArea>
          <EditableInput
            asChild
            onBlur={() => completion.clear()}
            onKeyDown={(e) => {
              if (e.key === "Tab" && completion.hasGhost) {
                e.preventDefault();
                const text = completion.accept();
                if (text) setValue((v) => v + text);
              } else if (e.key === "Escape" && completion.hasGhost) {
                completion.dismiss();
              }
            }}
          >
            <Input className="w-full" />
          </EditableInput>
          <EditablePreview />
        </EditableArea>
        <EditableControl>
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
      <Show when={completion.hasGhost}>
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
          <span className="min-w-0 flex-1 truncate italic">
            Append <span className="not-italic">“{completion.ghost.replace(/^\s+/, "")}”</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Kbd>Tab</Kbd> accept
          </span>
        </p>
      </Show>
    </Field>
  );
}
