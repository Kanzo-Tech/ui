"use client";

import {
  Question,
  QuestionChoice,
  QuestionChoices,
  QuestionDescription,
  QuestionPrompt,
  Show,
  type QuestionAnswer,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { ROLES } from "@/example/world";

/**
 * One question on its own — the decision a guided chat puts to the reader in a turn. A pick is the
 * answer, in one press; what happens next is the host's.
 */
export default function Example() {
  const [lead, setLead] = useState<QuestionAnswer | null>(null);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Question name="lead" onValueChange={(d) => setLead(d.value)} value={lead}>
        <QuestionPrompt>Who walks into the drowned lane first?</QuestionPrompt>
        <QuestionDescription>The contract names nobody, so it is yours to decide.</QuestionDescription>
        <QuestionChoices>
          {ROLES.slice(0, 3).map((role) => (
            <QuestionChoice description={role.duty} key={role.id} value={role.id}>
              {role.label}
            </QuestionChoice>
          ))}
        </QuestionChoices>
      </Question>
      <p className="text-muted-foreground text-sm">
        <Show fallback="Not answered yet." when={lead !== null}>
          Answered: {lead}
        </Show>
      </p>
    </div>
  );
}
