"use client";

import { Chat, ChatSkeleton, type Proposal, useAgentChat } from "@kanzo-tech/ai";
import { defineTask, propose } from "@kanzo-tech/ai/task";
import { jsonSchema, ToolLoopAgent } from "@kanzo-tech/llm";
import { Button } from "@kanzo-tech/ui";
import { useEffect, useState } from "react";
import { mockModel } from "@/lib/mock-model";

// The questions a model would offer for the board. The last is long on purpose: in a panel this
// narrow it is cut with an ellipsis, and the whole question is in its tooltip.
const OFFERED = [
  { text: "What is out and late?", rationale: "due and closed" },
  { text: "Who signed for the most contracts?", rationale: "party" },
  {
    text: "Which regions have more contracts closed late than on time since the last charter?",
    rationale: "region, due and closed",
  },
];

/** A Task whose artefact is a question: what it says, and what in the board it rests on. */
const questions = defineTask<string, { text: string; rationale: string }>({
  name: "board-questions",
  instructions: "You offer questions a quartermaster would ask of the board.",
  prompt: (board) => `The board: ${board}`,
  output: () =>
    jsonSchema({
      type: "object",
      properties: { text: { type: "string" }, rationale: { type: "string" } },
      required: ["text", "rationale"],
    }),
});

// In a product the model is the host's; here it is a mock.
const model = mockModel(() => JSON.stringify({ elements: OFFERED }));
const agent = new ToolLoopAgent({ model: mockModel(() => "Ask the board.") });

export default function Example() {
  const chat = useAgentChat(agent);
  const [ready, setReady] = useState(false);
  const [round, setRound] = useState(0);
  const [offered, setOffered] = useState<Proposal[]>([]);
  const [proposing, setProposing] = useState(true);

  // A first beat as a skeleton — the host still loading what the chat needs — then the chat.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
  }, [round]);

  useEffect(() => {
    const abort = new AbortController();
    setOffered([]);
    setProposing(true);
    propose(questions, "contracts, their party, region, due and closed days", { model, signal: abort.signal, count: 3 }).then(
      (proposals) => {
        setOffered(proposals.map((p) => p.value));
        setProposing(false);
      },
      // Proposing failed: no pills, and the chat still works.
      () => !abort.signal.aborted && setProposing(false),
    );
    return () => abort.abort();
  }, [round]);

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex h-96 flex-col rounded-xl border p-2">
        {ready ? <Chat chat={chat} proposals={offered} proposing={proposing} /> : <ChatSkeleton />}
      </div>
      <Button
        className="self-start"
        onClick={() => {
          setReady(false);
          setRound((n) => n + 1);
        }}
        size="sm"
        variant="outline"
      >
        Again
      </Button>
    </div>
  );
}
