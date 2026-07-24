"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from "@kanzo-tech/ui";
import { useState } from "react";

// Inline ghost completion is declared ONCE on `Field` (`complete`), and the surface opts in with
// `aiComplete` — `Input` for a single line, `Textarea` for prose. Both paint a muted continuation
// at the caret; Tab accepts, Esc dismisses. The control stays oblivious to the model.
async function* completeTitle(value: string, signal?: AbortSignal) {
  const rest = " (Spain, 2020–2023)";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 60));
    if (signal?.aborted) return;
    yield chunk;
  }
}

async function* completeSummary(value: string, signal?: AbortSignal) {
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
      <Field complete={completeTitle}>
        <FieldLabel>Title</FieldLabel>
        <Input
          aiComplete
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. COVID-19 case registry"
          value={title}
        />
        <FieldDescription>Single line — Tab accepts the greyed continuation.</FieldDescription>
      </Field>

      <Field complete={completeSummary}>
        <FieldLabel>Description</FieldLabel>
        <Textarea
          aiComplete
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe the dataset…"
          value={summary}
        />
        <FieldDescription>Multi-line — the ghost wraps with the textarea.</FieldDescription>
      </Field>
    </div>
  );
}
