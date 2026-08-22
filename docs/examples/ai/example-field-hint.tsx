"use client";

import {
  Button,
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
  CompleteHint,
  CompleteMark,
  CompleteRoot,
  CompleteTextarea,
} from "@kanzo-tech/ai";
import { SendHorizontalIcon } from "lucide-react";
import { useState } from "react";

async function* completeReply({ signal }: InlineCompletionRequest) {
  const rest =
    " — two of them working the near bank and one holding the lane, which is a pack and not a stray, so the writ wants a party of four and a lantern.";
  for (const chunk of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 45));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [reply, setReply] = useState("Confirming the sighting at the ford");

  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Reply to the hall</FieldLabel>
      {/* A docked composer: the box is fixed by the pane it sits in, and the toolbar band owns its
          bottom edge. `CompleteGhost` would take the height it needs and push both — so the offer
          goes UNDER the field instead. `CompleteHint` is the swap, never a second copy beside it. */}
      <CompleteRoot complete={completeReply} onValueChange={setReply} value={reply}>
        <InputGroup>
          <CompleteTextarea>
            <InputGroupTextarea
              className="resize-none"
              placeholder="What goes back to the hall…"
              rows={2}
            />
          </CompleteTextarea>
          <InputGroupAddon align="block-end">
            <CompleteMark />
            <Button className="ms-auto" size="icon-sm" variant="ghost">
              <SendHorizontalIcon />
              <span className="sr-only">Send</span>
            </Button>
          </InputGroupAddon>
        </InputGroup>
        {/* Carries the keys itself, so there is no `CompleteKeys` beside it. */}
        <CompleteHint />
        <CompleteError />
      </CompleteRoot>
      <FieldDescription>
        The continuation streams below the field, wrapped, with the keys named beside it.
      </FieldDescription>
    </Field>
  );
}
