"use client";

import {
  Card,
  CardContent,
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTextarea,
  QuestionnaireTitle,
  Show,
  type QuestionnaireAnswers,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { FEATURED } from "@/example/quests";
import { grade, GRADES, QUEST_STATUSES, ROLES } from "@/example/world";

/**
 * The after-action report an archivist files when a contract comes back — here, the one that did
 * not: `Map the drowned lane`.
 *
 * The parent owns what the root does not: whether the form is on screen at all, and what happens to
 * the payload. Submitting here swaps the form for what was filed, which is the smallest honest
 * version of that division.
 */
const OUTCOMES = QUEST_STATUSES.filter((status) => status.terminal);

export default function Example() {
  const [filed, setFiled] = useState<QuestionnaireAnswers | null>(null);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent>
        <Show
          fallback={
            <Questionnaire onSubmit={setFiled} shortcuts>
              <QuestionnaireProgress />

              <QuestionnaireItem name="outcome" required>
                <QuestionnaireTitle>How did it end?</QuestionnaireTitle>
                <QuestionnaireDescription>
                  {FEATURED.failed.id} · {FEATURED.failed.title}
                </QuestionnaireDescription>
                <QuestionnaireChoices>
                  {OUTCOMES.map((status) => (
                    <QuestionnaireChoice
                      description={status.description}
                      key={status.id}
                      value={status.id}
                    >
                      {status.label}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError />
              </QuestionnaireItem>

              <QuestionnaireItem multiple name="short" required>
                <QuestionnaireTitle>What was the party short of?</QuestionnaireTitle>
                <QuestionnaireDescription>Pick every duty nobody covered.</QuestionnaireDescription>
                <QuestionnaireChoices>
                  {ROLES.map((role) => (
                    <QuestionnaireChoice description={role.duty} key={role.id} value={role.id}>
                      {role.label}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>
                  Name at least one — “nothing” is an answer the board cannot act on.
                </QuestionnaireError>
              </QuestionnaireItem>

              <QuestionnaireItem name="grade" required>
                <QuestionnaireTitle>Grade it again</QuestionnaireTitle>
                <QuestionnaireDescription>
                  It was posted as a {grade(FEATURED.failed.grade).label}.
                </QuestionnaireDescription>
                <QuestionnaireChoices>
                  {GRADES.map((step) => (
                    <QuestionnaireChoice
                      description={step.note}
                      key={step.value}
                      value={String(step.value)}
                    >
                      {step.label}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError />
              </QuestionnaireItem>

              <QuestionnaireItem name="notes" skippable>
                <QuestionnaireTitle>Anything for the next party?</QuestionnaireTitle>
                <QuestionnaireTextarea
                  placeholder="The ford is not where the map says it is…"
                  rows={3}
                />
              </QuestionnaireItem>

              <QuestionnaireActions>
                <QuestionnairePrevious />
                <QuestionnaireSkip />
                <QuestionnaireNext />
                <QuestionnaireSubmit>File report</QuestionnaireSubmit>
              </QuestionnaireActions>
            </Questionnaire>
          }
          when={filed !== null}
        >
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs">
            {JSON.stringify(filed, null, 2)}
          </pre>
        </Show>
      </CardContent>
    </Card>
  );
}
