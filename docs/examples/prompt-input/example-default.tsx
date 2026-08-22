"use client";

import { InputGroupText, Show } from "@kanzo-tech/ui";
import {
  type AiStatus,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@kanzo-tech/ai";
import { type FormEvent, useState } from "react";
import { FEATURED, questLabel } from "@/example/quests";
import { hall } from "@/example/world";

export default function Example() {
  const [status, setStatus] = useState<AiStatus>("idle");
  const [asked, setAsked] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // The button is one control wearing three labels, so the form handler is where the meanings
    // are told apart — Stop is a submit like any other.
    if (status === "loading") {
      setStatus("idle");
      return;
    }

    const form = event.currentTarget;
    const text = String(new FormData(form).get("prompt") ?? "").trim();
    if (!text) {
      setStatus("error");
      return;
    }

    setAsked(text);
    setStatus("loading");
    form.reset();
    // `ready` is an answer that arrived; the composer goes back to Send without pretending it
    // was never asked.
    setTimeout(() => setStatus("ready"), 1600);
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <PromptInput onSubmit={submit}>
        <PromptInputTextarea
          name="prompt"
          placeholder={`Ask about ${questLabel(FEATURED.overdue)}…`}
        />
        <PromptInputToolbar>
          <InputGroupText>{hall("amber").short} · the board and the roster</InputGroupText>
          <PromptInputSubmit status={status} />
        </PromptInputToolbar>
      </PromptInput>

      <Show
        fallback={
          <p className="text-muted-foreground text-sm">
            Enter sends, Shift+Enter breaks the line. Send nothing to see the error state.
          </p>
        }
        when={asked !== ""}
      >
        <p className="text-muted-foreground text-sm">Asked: “{asked}”</p>
      </Show>
    </div>
  );
}
