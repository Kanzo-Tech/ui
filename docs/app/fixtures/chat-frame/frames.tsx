"use client";

import { Chat, ChatSkeleton } from "@kanzo-tech/ai";

/** A chat with nothing said yet, whose suggesting failed: the strip it keeps is the hard case. */
const idle = {
  messages: [],
  status: "ready" as const,
  error: undefined,
  sendMessage: async () => {},
  stop: async () => {},
  regenerate: async () => {},
};

const empty = <p className="text-muted-foreground text-sm">Ask the quartermaster about the board.</p>;

/** The two parents a host gives a panel: a flex column, and a block that only has a height. */
const PARENTS = { column: "flex h-96 flex-col", block: "h-96" } as const;

export function Frames() {
  return (
    <main className="grid gap-6 p-6 md:grid-cols-2">
      {Object.entries(PARENTS).flatMap(([parent, className]) => [
        <section className={`${className} rounded-xl border p-2`} data-testid={`${parent}-skeleton`} key={`${parent}-skeleton`}>
          <ChatSkeleton empty={empty} />
        </section>,
        <section className={`${className} rounded-xl border p-2`} data-testid={`${parent}-chat`} key={`${parent}-chat`}>
          <Chat chat={idle as never} empty={empty} suggestions={[]} />
        </section>,
      ])}
    </main>
  );
}
