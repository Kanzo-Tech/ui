"use client";

import { Chat, useAgentChat } from "@kanzo-tech/ai";
import { scriptedModel } from "@kanzo-tech/llm/testing";
import { ToolLoopAgent } from "ai";
import { useState } from "react";
import { daysOverdue, FEATURED, overdueQuests, partyOf, questLabel } from "@/example/quests";
import { role } from "@/example/world";
import { askOf, offered } from "@/lib/model-call";
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
  // In a product the model is `localModel(…)`; here it is a mock, so the page needs no
  // network. Everything after it — the agent, useAgentChat, Chat — is what a product runs.
  const [pace] = useState(() => ({ perWord: 40 }));
  const [agent] = useState(
    () =>
      new ToolLoopAgent({
        model: scriptedModel({ turns: (call) => ANSWERS[askOf(call)] ?? { text: "I can only read the board." }, pace }),
      }),
  );
  const chat = useAgentChat(agent);

  useAutoplay((mode) => {
    pace.perWord = mode === "play" ? 40 : 0;
    void chat.sendMessage({ text: QUESTIONS[0]! });
  });

  return (
    <div className="flex h-104 w-full max-w-xl flex-col">
      <Chat
        chat={chat}
        empty={<p className="text-muted-foreground text-sm">Ask the quartermaster about the board.</p>}
        proposals={offered(...QUESTIONS)}
      />
    </div>
  );
}
