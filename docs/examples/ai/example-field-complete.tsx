"use client";

import {
  CompleteGhost,
  CompleteHint,
  CompleteInput,
  CompleteRoot,
  CompleteTextarea,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from "@kanzo-tech/ui";
import { useState } from "react";

async function* completeTitle(_value: string, signal?: AbortSignal) {
  const rest = " on the Greenhollow causeway";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 60));
    if (signal?.aborted) return;
    yield chunk;
  }
}

async function* completeNotice(_value: string, signal?: AbortSignal) {
  const rest =
    " The ground is standing water from the ford to the lane, the herder walks back with the party, and nothing above a Nuisance is expected before dusk.";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 45));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [title, setTitle] = useState("Bog-hounds took the herd dog");
  const [notice, setNotice] = useState("Three hounds seen at the ford, in threes as they go");

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Field>
        <FieldLabel>Title</FieldLabel>
        <CompleteRoot complete={completeTitle} onValueChange={setTitle} value={title}>
          <CompleteInput>
            <Input placeholder="e.g. A wyrm under the granary" />
          </CompleteInput>
          <CompleteGhost />
        </CompleteRoot>
        <FieldDescription>Single line — Tab accepts the greyed continuation.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Notice</FieldLabel>
        <CompleteRoot complete={completeNotice} onValueChange={setNotice} value={notice}>
          <CompleteTextarea>
            <Textarea placeholder="What the party is walking into…" />
          </CompleteTextarea>
          <CompleteHint />
        </CompleteRoot>
        <FieldDescription>Multi-line — the suggestion streams as a hint below.</FieldDescription>
      </Field>
    </div>
  );
}
