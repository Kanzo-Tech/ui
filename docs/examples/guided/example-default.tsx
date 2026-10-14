"use client";

import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageList,
  ModelBadge,
  Working,
} from "@kanzo-tech/ai";
import {
  Question,
  QuestionChoice,
  QuestionChoices,
  QuestionDescription,
  QuestionPrompt,
  Show,
  Suggestion,
  Suggestions,
  type QuestionAnswer,
} from "@kanzo-tech/ui";
import { useEffect, useState } from "react";

// A Task's `Decision`, as `verify` raises it.
const decision = {
  id: "prize",
  question: "What is a prize's amount?",
  options: [
    { id: "whole", label: "The whole prize" },
    { id: "share", label: "A fraction of the prize" },
  ],
};

const OFFERED = [
  { text: "Who won the most prizes?", rationale: "Laureate and Award" },
  { text: "Which universities trained the most laureates?", rationale: "University" },
];

export default function Example() {
  const [read, setRead] = useState(0);
  const [chosen, setChosen] = useState<QuestionAnswer | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  // Six files read, one every half second, then again.
  useEffect(() => {
    const timer = setInterval(() => setRead((n) => (n + 1) % 7), 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-[36rem] w-full max-w-xl flex-col">
      <Conversation>
        <ConversationContent>
          <MessageList className="gap-5">
            <ModelBadge className="self-start" load={{ state: "loading", progress: read / 6, text: "Fetching param cache" }} />
            <Message role="assistant">
              <MessageContent>
                <Working value={(read / 6) * 100}>Reading your files… {read} of 6</Working>
              </MessageContent>
            </Message>
            <Message role="assistant">
              <MessageContent>
                <Question name={decision.id} onValueChange={(d) => setChosen(d.value)} value={chosen}>
                  <QuestionPrompt>{decision.question}</QuestionPrompt>
                  <QuestionDescription>It has no safe answer, so it is yours to decide.</QuestionDescription>
                  <QuestionChoices>
                    {decision.options.map((option) => (
                      <QuestionChoice key={option.id} value={option.id}>
                        {option.label}
                      </QuestionChoice>
                    ))}
                  </QuestionChoices>
                </Question>
              </MessageContent>
            </Message>
            <Message role="assistant">
              <MessageContent className="gap-3">
                <p>What would you like to know?</p>
                <Suggestions pending={1}>
                  {OFFERED.map((o) => (
                    <Suggestion description={o.rationale} key={o.text} onSelect={setAsked} value={o.text} />
                  ))}
                </Suggestions>
              </MessageContent>
            </Message>
            <Show when={asked !== null}>
              <Message role="user">
                <MessageContent>{asked}</MessageContent>
              </Message>
            </Show>
          </MessageList>
        </ConversationContent>
      </Conversation>
    </div>
  );
}
