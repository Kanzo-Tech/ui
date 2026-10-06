"use client";

import { Chat, useChat } from "@kanzo-tech/ai";
import { DirectChatTransport, ToolLoopAgent } from "@kanzo-tech/llm";
import { useRef, useState } from "react";
import { daysOverdue, FEATURED, overdueQuests, partyOf, questLabel } from "@/example/quests";
import { role } from "@/example/world";
import { askOf, mockModel } from "@/lib/mock-model";
import { useAutoplay } from "@/lib/preview-autoplay";

const late = FEATURED.overdue;

const QUESTIONS = ["What is out and late?", "Who signed for the worst of it?"];

// What the quartermaster's model would say, read off the board so it cannot disagree with the
// tables elsewhere in these docs.
const ANSWERS: Record<string, { reasoning: string; text: string }> = {
  [QUESTIONS[0]!]: {
    reasoning: "Late means past its due day and not yet closed. Count those, then name the worst.",
    text: `**${overdueQuests().length} contracts** are past due. The worst is ${questLabel(late)}:\n\n- ${daysOverdue(late)} days late\n- grade ${late.grade}, in ${late.region}`,
  },
  [QUESTIONS[1]!]: {
    reasoning: "The worst one is the basilisk contract. Read its party off the board.",
    text: `${partyOf(late)
      .map((member) => `**${member.name}**, ${role(member.role).label.toLowerCase()}`)
      .join(" and ")} — ${late.party.length} names on a grade ${late.grade}, and no cantor.`,
  },
};

export default function Example() {
  // In a product the model is `gateway("chat")`; here it is a mock, so the page needs no
  // network. Everything after it — the agent, the transport, useChat, Chat — is what a product runs.
  const pace = useRef(40);
  const [transport] = useState(
    () =>
      new DirectChatTransport({
        agent: new ToolLoopAgent({
          model: mockModel((call) => ANSWERS[askOf(call)] ?? "I can only read the board.", {
            delay: () => pace.current,
          }),
        }),
      }),
  );
  const chat = useChat({ transport });

  useAutoplay((mode) => {
    pace.current = mode === "play" ? 40 : 0;
    void chat.sendMessage({ text: QUESTIONS[0]! });
  });

  return (
    <div className="flex h-104 w-full max-w-xl flex-col">
      <Chat
        chat={chat}
        empty={<p className="text-muted-foreground text-sm">Ask the quartermaster about the board.</p>}
        suggestions={QUESTIONS.map((text) => ({ text }))}
      />
    </div>
  );
}
