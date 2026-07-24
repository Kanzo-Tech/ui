"use client";

import { useState } from "react";
import {
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableEditTrigger,
  EditableInput,
  EditableLabel,
  EditablePreview,
  EditableSubmitTrigger,
  Kbd,
  useCompletion,
} from "@kanzo-tech/ui";

// A fake `complete` — swap for your model's stream. It honours the signal.
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
    <Editable
      activationMode="click"
      onValueChange={(d) => {
        setValue(d.value);
        completion.setValue(d.value);
      }}
      placeholder="Name this dataset…"
      value={value}
    >
      <EditableLabel>Dataset name</EditableLabel>
      <EditableArea>
        <EditablePreview />
        <EditableInput
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
        />
      </EditableArea>
      <EditableControl>
        <EditableEditTrigger />
        <EditableSubmitTrigger />
        <EditableCancelTrigger />
      </EditableControl>
      {completion.hasGhost && (
        <p className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="truncate italic">
            Append <span className="not-italic">“{completion.ghost}”</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Kbd>Tab</Kbd> accept
          </span>
        </p>
      )}
    </Editable>
  );
}
