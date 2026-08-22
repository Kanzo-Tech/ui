"use client";

import { MessagesSquareIcon } from "lucide-react";
import { Button, Show } from "@kanzo-tech/ui";
import {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageList,
  MessageText,
} from "@kanzo-tech/ai";
import { useEffect, useState } from "react";
import { daysOverdue, FEATURED, overdueQuests, partyOf, questLabel } from "@/example/quests";
import { breaches } from "@/example/rules";
import { withRole } from "@/example/roster";
import { role } from "@/example/world";
import { upTo, wordsIn } from "@/lib/stream";

const late = FEATURED.overdue;
const broken = breaches().filter((entry) => entry.quest.id === late.id);
const freeCantors = withRole("cantor").filter((entry) => entry.availability === "ready");

// The quartermaster's triage, one morning. Every number below is read off the board and the
// roster, so the transcript cannot disagree with the tables elsewhere in these docs.
const TURNS = [
  { id: "ask-late", role: "user" as const, text: "What is out and late?" },
  {
    id: "say-late",
    role: "assistant" as const,
    text: `${overdueQuests().length} contracts are past due. The worst is ${questLabel(late)} — ${daysOverdue(late)} days, in ${late.region}.`,
  },
  { id: "ask-party", role: "user" as const, text: "Who signed for it?" },
  {
    id: "say-party",
    role: "assistant" as const,
    text: `${partyOf(late)
      .map((member) => `${member.name}, ${role(member.role).label.toLowerCase()}`)
      .join("; ")}. That is ${late.party.length} names on a grade ${late.grade}.`,
  },
  { id: "ask-rules", role: "user" as const, text: "Does that break anything?" },
  {
    id: "say-rules",
    role: "assistant" as const,
    text: `${broken.length} of the standing orders. ${broken
      .map((entry) => `“${entry.rule}” — ${entry.message}`)
      .join(" ")}`,
  },
  { id: "ask-send", role: "user" as const, text: "Who can I send after them?" },
  {
    id: "say-send",
    role: "assistant" as const,
    text: `${freeCantors.map((entry) => entry.name).join(", ")} — the cantors the roster shows ready today.`,
  },
];

/** Beat lengths, in ms. A user turn lands whole; an assistant turn is written. */
const READ = 900;
const SETTLE = 700;
const PER_WORD = 55;

export default function Example() {
  // `turn` is which turn is arriving, `words` how much of it has. A user turn skips the writing:
  // somebody typed it and pressed Enter, and animating that would be a lie about who is talking.
  const [at, setAt] = useState({ turn: -1, words: 0 });

  useEffect(() => {
    const turn = TURNS[at.turn];
    const wait = (ms: number, next: typeof at) => {
      const timer = setTimeout(() => setAt(next), ms);
      return () => clearTimeout(timer);
    };
    if (at.turn < 0) return wait(READ, { turn: 0, words: 0 });
    if (!turn) return;
    if (turn.role === "user") return wait(READ, { turn: at.turn + 1, words: 0 });
    if (at.words >= wordsIn(turn.text)) return wait(SETTLE, { turn: at.turn + 1, words: 0 });
    return wait(PER_WORD, { turn: at.turn, words: at.words + 1 });
  }, [at]);

  const done = at.turn >= TURNS.length;
  const shown = TURNS.slice(0, Math.max(at.turn + 1, 0)).map((turn, index) => {
    const arriving = index === at.turn && turn.role === "assistant";
    return {
      ...turn,
      streaming: arriving && at.words < wordsIn(turn.text),
      text: arriving ? upTo(turn.text, at.words) : turn.text,
    };
  });

  return (
    <div className="flex h-[340px] w-full max-w-xl flex-col rounded-lg border border-border">
      <Conversation>
        <ConversationContent>
          <Show
            fallback={
              <ConversationEmpty>
                <MessagesSquareIcon />
                Nothing asked yet. The board is quiet.
              </ConversationEmpty>
            }
            when={shown.length > 0}
          >
            <MessageList>
              {shown.map((turn) => (
                <Message key={turn.id} role={turn.role}>
                  {/* The user's words are already written; only the model's arrive. */}
                  <MessageContent>
                    <Show fallback={turn.text} when={turn.role === "assistant"}>
                      <MessageText streaming={turn.streaming}>{turn.text}</MessageText>
                    </Show>
                  </MessageContent>
                </Message>
              ))}
            </MessageList>
          </Show>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-border border-t p-2">
        {/* It plays on its own. The only control is the one that lets you watch it again — a
            "next turn" button made the reader drive a demonstration of something that streams. */}
        <Button disabled={!done} onClick={() => setAt({ turn: -1, words: 0 })} size="sm" variant="outline">
          Replay
        </Button>
      </div>
    </div>
  );
}
