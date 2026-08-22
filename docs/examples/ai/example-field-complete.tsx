"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@kanzo-tech/ui";
import {
  type InlineCompletionRequest,
  CompleteError,
  CompleteGhost,
  CompleteKeys,
  CompleteMark,
  CompleteRoot,
  CompleteTextarea,
} from "@kanzo-tech/ai";
import { useState } from "react";

async function* completeNotice({ signal }: InlineCompletionRequest) {
  const rest =
    " The ground is standing water from the ford to the lane, the herder walks back with the party, and nothing above a Nuisance is expected before dusk.";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 45));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [notice, setNotice] = useState("Three hounds seen at the ford, in threes as they go");

  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Notice</FieldLabel>
      {/* The ✨ is an addon INSIDE the group, not a control on the label row: it marks this box as
          assisted, and the group is what the ghost aligns against. */}
      <CompleteRoot complete={completeNotice} onValueChange={setNotice} value={notice}>
        <InputGroup>
          <CompleteTextarea>
            <InputGroupTextarea placeholder="What the party is walking into…" rows={4} />
          </CompleteTextarea>
          <InputGroupAddon align="block-end">
            <CompleteMark />
            {/* The band under a textarea is where they belong: inside the field, beside the mark
                that produced the offer. */}
            <CompleteKeys className="ms-auto" />
          </InputGroupAddon>
        </InputGroup>
        <CompleteGhost />
        <CompleteError />
      </CompleteRoot>
      <FieldDescription>
        A continuation is offered at the caret, not only at the end — and the field grows to hold
        it.
      </FieldDescription>
    </Field>
  );
}
