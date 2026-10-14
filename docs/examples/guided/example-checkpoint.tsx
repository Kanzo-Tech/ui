"use client";

import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageList,
} from "@kanzo-tech/ai";
import { Button } from "@kanzo-tech/ui";
import { Fragment, useState } from "react";

type Turn = { id: string; role: "user" | "assistant"; text: string; preview?: string };

// Each preview the assistant drew is a checkpoint after its turn.
const THREAD: Turn[] = [
  { id: "1", role: "user", text: "Chart the contracts by year." },
  { id: "2", role: "assistant", text: "A bar per year, counting contracts.", preview: "Preview 1" },
  { id: "3", role: "user", text: "Split each bar by region." },
  { id: "4", role: "assistant", text: "Each bar is now stacked by region.", preview: "Preview 2" },
  { id: "5", role: "user", text: "Make it a line per region instead." },
  { id: "6", role: "assistant", text: "One line per region, by year.", preview: "Preview 3" },
];

export default function Example() {
  const [turns, setTurns] = useState(THREAD);
  const latest = [...turns].reverse().find((turn) => turn.preview)?.id;

  // Restoring cuts the thread: every turn after the checkpoint goes, and the preview is current.
  const restore = (id: string) => setTurns((all) => all.slice(0, all.findIndex((turn) => turn.id === id) + 1));

  return (
    <div className="flex h-[30rem] w-full max-w-xl flex-col gap-3">
      <Conversation>
        <ConversationContent>
          <MessageList className="gap-4">
            {turns.map((turn) => (
              <Fragment key={turn.id}>
                <Message role={turn.role}>
                  <MessageContent>{turn.text}</MessageContent>
                </Message>
                {turn.preview && (
                  <Checkpoint>
                    <CheckpointIcon />
                    <span>{turn.preview}</span>
                    {turn.id !== latest && <CheckpointTrigger onClick={() => restore(turn.id)} />}
                  </Checkpoint>
                )}
              </Fragment>
            ))}
          </MessageList>
        </ConversationContent>
      </Conversation>
      <Button className="self-start" disabled={turns.length === THREAD.length} onClick={() => setTurns(THREAD)} size="sm" variant="outline">
        Start the example again
      </Button>
    </div>
  );
}
