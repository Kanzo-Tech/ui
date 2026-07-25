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
  const rest = " (Spain, 2020–2023)";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 60));
    if (signal?.aborted) return;
    yield chunk;
  }
}

async function* completeSummary(_value: string, signal?: AbortSignal) {
  const rest =
    " The dataset is refreshed weekly and covers every autonomous community, with demographic breakdowns for secondary research.";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 45));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [title, setTitle] = useState("COVID-19 case registry");
  const [summary, setSummary] = useState("Anonymised national registry of confirmed cases");

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Field>
        <FieldLabel>Title</FieldLabel>
        <CompleteRoot complete={completeTitle} onValueChange={setTitle} value={title}>
          <CompleteInput>
            <Input placeholder="e.g. COVID-19 case registry" />
          </CompleteInput>
          <CompleteGhost />
        </CompleteRoot>
        <FieldDescription>Single line — Tab accepts the greyed continuation.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <CompleteRoot complete={completeSummary} onValueChange={setSummary} value={summary}>
          <CompleteTextarea>
            <Textarea placeholder="Describe the dataset…" />
          </CompleteTextarea>
          <CompleteHint />
        </CompleteRoot>
        <FieldDescription>Multi-line — the suggestion streams as a hint below.</FieldDescription>
      </Field>
    </div>
  );
}
