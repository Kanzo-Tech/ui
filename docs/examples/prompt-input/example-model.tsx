"use client";

import { type FormEvent, useState } from "react";
import {
  type AiStatus,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@kanzo-tech/ai";
import {
  cn,
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";
import { FEATURED, questLabel } from "@/example/quests";

/**
 * Choosing which model answers, in the strip where the choice belongs.
 *
 * There is no component for this. The picker is a `Select` — a model is a value, and a value
 * control keeps its value without being told to — and the only thing the composer asks of it is
 * that it stop looking like a form field: no border, no fill, no shadow, and the same `bg-accent`
 * on hover that every other control in the strip takes.
 */
const models = createListCollection({
  items: [
    { label: "Opus", value: "opus" },
    { label: "Sonnet", value: "sonnet" },
    { label: "Haiku", value: "haiku" },
    { label: "Local", value: "local" },
  ],
});

export default function Example() {
  const [status, setStatus] = useState<AiStatus>("idle");
  const [model, setModel] = useState("sonnet");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setTimeout(() => setStatus("ready"), 1200);
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <PromptInput onSubmit={submit}>
        <PromptInputTextarea
          name="prompt"
          placeholder={`Ask about ${questLabel(FEATURED.overdue)}…`}
        />
        <PromptInputToolbar>
          <Select
            collection={models}
            onValueChange={(details) => setModel(details.value[0] ?? model)}
            value={[model]}
          >
            <SelectTrigger
              className={cn(
                "w-auto border-none bg-transparent shadow-none",
                "font-medium text-muted-foreground",
                "hover:bg-accent hover:text-foreground",
                "aria-expanded:bg-accent aria-expanded:text-foreground",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.items.map((item) => (
                <SelectItem item={item} key={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PromptInputSubmit status={status} />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
