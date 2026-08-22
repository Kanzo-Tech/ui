"use client";

import { Button } from "@kanzo-tech/ui";
import { MessageText, Reasoning, ReasoningContent, ReasoningTrigger } from "@kanzo-tech/ai";
import { useEffect, useState } from "react";
import { daysOverdue, FEATURED, partyOf } from "@/example/quests";
import { breaches } from "@/example/rules";
import { role } from "@/example/world";
import { upTo, wordsIn } from "@/lib/stream";

const late = FEATURED.overdue;

const THOUGHT = [
  `${late.id} is a grade ${late.grade} contract, ${daysOverdue(late)} days past its due date, and still afield in ${late.region}.`,
  `The party is ${partyOf(late)
    .map((member) => `${member.name} (${role(member.role).label.toLowerCase()})`)
    .join(" and ")}.`,
  ...breaches()
    .filter((entry) => entry.quest.id === late.id)
    .map((entry) => `“${entry.rule}” fails: ${entry.message}`),
  "So the answer is not a status. It is who to send after them.",
];

const FULL = THOUGHT.join("\n");

export default function Example() {
  // It thinks on load. A button that starts it made the reader drive the demonstration of
  // something that arrives on its own, which is the one thing this component is about.
  const [words, setWords] = useState(0);
  const streaming = words < wordsIn(FULL);

  useEffect(() => {
    if (!streaming) return;
    const timer = setTimeout(() => setWords((count) => count + 1), 45);
    return () => clearTimeout(timer);
  }, [streaming, words]);

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <Reasoning streaming={streaming}>
        <ReasoningTrigger />
        {/* `MessageText` is the same arrival the transcript uses — the thinking is not a different
            kind of stream, so it is not a second treatment. */}
        <ReasoningContent>
          <MessageText streaming={streaming}>{upTo(FULL, words)}</MessageText>
        </ReasoningContent>
      </Reasoning>

      <Button disabled={streaming} onClick={() => setWords(0)} size="sm" variant="outline">
        Think it through again
      </Button>
    </div>
  );
}
