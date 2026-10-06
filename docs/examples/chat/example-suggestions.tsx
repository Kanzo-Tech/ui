"use client";

import { Chat, ChatSkeleton, type Proposal, suggest, useChat } from "@kanzo-tech/ai";
import { DirectChatTransport, ToolLoopAgent } from "@kanzo-tech/llm";
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

// In a product the model is `gateway("chat")`; here it is a mock that streams the answer a word at
// a time, so the skeleton pills are on screen long enough to see.
const model = mockModel(() => JSON.stringify({ elements: OFFERED }), { delay: 25 });
const transport = new DirectChatTransport({
  agent: new ToolLoopAgent({ model: mockModel(() => "Ask the board.") }),
});

export default function Example() {
  const chat = useChat({ transport });
  const [ready, setReady] = useState(false);
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<Proposal[]>([]);
  const [suggesting, setSuggesting] = useState(true);

  // A first beat as a skeleton — the host still loading what the chat needs — then the chat.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
  }, [round]);

  useEffect(() => {
    const abort = new AbortController();
    setQuestions([]);
    setSuggesting(true);
    (async () => {
      const got: Proposal[] = [];
      for await (const q of suggest({
        model,
        instructions: "Suggest questions a quartermaster would ask of the board.",
        prompt: "The board: contracts, their party, region, due and closed days.",
        abortSignal: abort.signal,
      })) {
        got.push(q);
        setQuestions([...got]);
      }
      setSuggesting(false);
    })().catch(() => {
      // Suggesting failed: no pills, and the chat still works.
      if (!abort.signal.aborted) {
        setQuestions([]);
        setSuggesting(false);
      }
    });
    return () => abort.abort();
  }, [round]);

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex h-96 flex-col rounded-xl border p-2">
        {ready ? <Chat chat={chat} suggesting={suggesting} suggestions={questions} /> : <ChatSkeleton />}
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
