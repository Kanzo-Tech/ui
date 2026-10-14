"use client";

import { Field, FieldHelper, FieldLabel, Textarea } from "@kanzo-tech/ui";
import { Assist, AssistProvider } from "@kanzo-tech/ai";
import { useState } from "react";
import { promptOf, scriptedModel } from "@kanzo-tech/llm/testing";
import { PACE } from "@/lib/model-call";

// Stands in for `localModel(…)`. Each earlier offer the reader skipped with Alt+] comes
// back in the prompt as a "- " line, so the count of them picks the next continuation.
const CONTINUATIONS = [
  " — the ground is standing water from the ford to the lane.",
  ", and the herder walks back with the party.",
  ". Nothing above a Nuisance is expected before dusk.",
];
const model = scriptedModel({
  turns: (call) => {
    const skipped = promptOf(call).match(/^- /gm)?.length ?? 0;
    return { text: CONTINUATIONS[skipped % CONTINUATIONS.length] ?? "" };
  },
  pace: PACE,
});

export default function Example() {
  const [notice, setNotice] = useState("Three hounds seen at the ford, in threes as they go");

  return (
    <AssistProvider context="A notice board for a village hall, read by adventurers." model={model}>
      <Field className="w-full max-w-md">
        <FieldLabel>Notice</FieldLabel>
        <Assist onValueChange={setNotice} value={notice}>
          <Textarea placeholder="What the party is walking into…" rows={4} />
        </Assist>
        {/* FieldHelper, not FieldDescription: it is the one wired to the control by
            aria-describedby, and that is how the model is told what the field is for. */}
        <FieldHelper>What the party is walking into, in the hall's own words.</FieldHelper>
      </Field>
    </AssistProvider>
  );
}
