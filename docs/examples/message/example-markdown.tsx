"use client";

import { useEffect, useState } from "react";
import { Message, MessageAvatar, MessageContent, MessageList } from "@kanzo-tech/ai";
import { MessageMarkdown } from "@kanzo-tech/ai/markdown";
import { VIEWER } from "@/example/people";
import { dueOn, FEATURED, overdueQuests, partyOf } from "@/example/quests";
import { hall } from "@/example/world";

/**
 * The same transcript, answering in markdown — a heading, a list and a table, arriving a word at a
 * time.
 *
 * It streams for real rather than showing a finished answer, because the whole point of
 * `MessageMarkdown` is what happens **mid-token**: the answer below passes through `**bo`, `| Con`
 * and a half-opened list on its way to being correct, and none of that reaches the reader. Watch
 * the same string with `MessageText` and you get literal asterisks and pipes settling into place.
 */
const late = overdueQuests().slice(0, 3);
const crew = partyOf(FEATURED.overdue);

const ANSWER = [
  `## ${FEATURED.overdue.title}`,
  "",
  `It is **grade ${FEATURED.overdue.grade}**, it is past its date, and it is short a cantor —`,
  `${crew.length} signatures where a grade ${FEATURED.overdue.grade} wants four.`,
  "",
  "The three oldest on the board:",
  "",
  "| Contract | Region | Due |",
  "| --- | --- | --- |",
  ...late.map((q) => `| ${q.title} | ${q.region} | ${dueOn(q)} |`),
  "",
  "1. Fill the cantor seat from the posting hall.",
  "2. Re-date the writ, or fail it and re-post.",
].join("\n");

/** A word every 60 ms — slow enough to read the arrival, which is what this page is about. */
const WORD_MS = 60;

export default function Example() {
  const [upto, setUpto] = useState(0);

  useEffect(() => {
    // Restarts from zero, so the demo can be watched more than once without a reload.
    const id = setInterval(() => setUpto((n) => (n >= ANSWER.length ? 0 : n + nextWord(n))), WORD_MS);
    return () => clearInterval(id);
  }, []);

  const streaming = upto < ANSWER.length;

  return (
    <MessageList className="max-w-xl">
      <Message role="user">
        <MessageAvatar name={VIEWER.name} />
        <MessageContent>What is wrong with the basilisk contract?</MessageContent>
      </Message>

      <Message>
        <MessageAvatar name={hall(FEATURED.overdue.hall).short} />
        <MessageContent>
          <MessageMarkdown streaming={streaming}>{ANSWER.slice(0, upto)}</MessageMarkdown>
        </MessageContent>
      </Message>
    </MessageList>
  );
}

/** How far to the end of the next word, so the stream cuts where a stream would. */
function nextWord(from: number): number {
  const rest = ANSWER.slice(from);
  const match = /^\s*\S+/.exec(rest);
  return match ? match[0].length : 1;
}
