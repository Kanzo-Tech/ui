"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
  Show,
  Spinner,
} from "@kanzo-tech/ui";
import { type Suggestion, useSuggestions } from "@kanzo-tech/ai";
import { useState } from "react";

// Three sources, so every one of the four states is reachable from the page rather than described.
// The one worth steering into is `ready` with nothing in it: a source that answered and had nothing
// to say is an answer, and a surface that renders it as blank is a surface that looks broken.
type Source = "answers" | "empty" | "throws";

const POOL: Suggestion[] = [
  { value: "ford", rationale: "Named in four of the last six notices." },
  { value: "nightfall", rationale: "Every sighting is after dusk." },
];

export default function Example() {
  const [source, setSource] = useState<Source>("answers");
  const [chosen, setChosen] = useState<string[]>([]);

  // Written plainly: the hook reads `suggest` off a ref at the moment `ask()` runs, so the source
  // selected above is the one that answers. Nothing needs memoising to make that true.
  async function* suggest(signal?: AbortSignal) {
    await new Promise((r) => setTimeout(r, 400));
    if (signal?.aborted) return;
    if (source === "throws") throw new Error("The hall did not answer.");
    if (source === "empty") return;
    for (const item of POOL) {
      await new Promise((r) => setTimeout(r, 260));
      if (signal?.aborted) return;
      yield item;
    }
  }

  const suggestions = useSuggestions({ suggest, existing: chosen, limit: 3 });

  const pick = (value: string) => {
    setChosen((prev) => [...prev, value]);
    suggestions.dismiss(value);
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <SegmentGroup
        aria-label="What the source does"
        className="w-fit rounded-md bg-muted p-1"
        onValueChange={(e) => setSource(e.value as Source)}
        value={source}
      >
        {[
          ["answers", "Answers"],
          ["empty", "Says nothing"],
          ["throws", "Throws"],
        ].map(([value, label]) => (
          <SegmentGroupItem className="px-3 py-1.5" key={value} value={value}>
            <SegmentGroupItemText className="font-medium text-sm">{label}</SegmentGroupItemText>
          </SegmentGroupItem>
        ))}
      </SegmentGroup>

      <ButtonGroup aria-label="Suggestion controls">
        {/* `ask()` is gated on `idle`, so it is disabled while a run is on screen or in flight —
            which is the gate made visible rather than a click that does nothing. */}
        <Button
          disabled={suggestions.status !== "idle"}
          onClick={suggestions.ask}
          size="sm"
          variant="outline"
        >
          Ask
        </Button>
        <Button onClick={suggestions.refresh} size="sm" variant="outline">
          Again
        </Button>
      </ButtonGroup>

      <p className="font-mono text-muted-foreground text-xs">status: {suggestions.status}</p>

      <Show when={suggestions.status === "loading"}>
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner className="size-4" /> Asking the hall…
        </span>
      </Show>

      {/* The state this example exists for. `ready` with no items is said out loud. */}
      <Show when={suggestions.status === "ready" && suggestions.items.length === 0}>
        <p className="text-muted-foreground text-sm">Nothing to suggest.</p>
      </Show>

      <Show when={suggestions.error !== null}>
        <p className="text-destructive text-sm">{suggestions.error}</p>
      </Show>

      <ul className="flex flex-wrap gap-1.5">
        {suggestions.items.map((item) => (
          <li key={item.value}>
            <Button onClick={() => pick(item.value)} size="sm" variant="outline">
              {item.label ?? item.value}
            </Button>
          </li>
        ))}
      </ul>

      {/* Take the last one and the status goes back to `idle`: nothing left of an answer is not an
          answer with nothing in it, so Ask lights up again instead of dying for the session. */}
      <Show when={chosen.length > 0}>
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((value) => (
            <Badge key={value} variant="secondary">
              {value}
            </Badge>
          ))}
        </div>
      </Show>
    </div>
  );
}
