"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  Show,
} from "@kanzo-tech/ui";
import {
  useAiStream,
} from "@kanzo-tech/ai";
import { useState } from "react";
import { useAutoplay } from "@/lib/preview-autoplay";

// A stub source. A product would open a `fetch` here; the engine only ever sees an async
// iterable and an `AbortSignal`, so a hard-coded array is a legitimate implementation.
const WORDS =
  "The engine owns the iterator, the abort controller and the status — not the markup, and not your value.".split(
    /(?<=\s)/,
  );

const PACE = 90;

// The per-chunk delay is a parameter so `settle` can run the SAME source at 0 ms: under reduced
// motion the reader gets the finished text, not a stream and not a placeholder.
const source = (pace: number) =>
  async function* (signal: AbortSignal) {
    for (const word of WORDS) {
      await new Promise((r) => setTimeout(r, pace));
      if (signal.aborted) return;
      yield word;
    }
  };

export default function Example() {
  const engine = useAiStream<string>("Couldn’t reach the stub");
  const [text, setText] = useState("");
  const [words, setWords] = useState(0);

  // The whole read side. There is no loop to write: `run` owns the iterator and hands each value
  // over, and returning `false` is how a consumer says it has enough.
  const stream = (budget: number, pace = PACE) => {
    setText("");
    setWords(0);
    let taken = 0;
    void engine.run(source(pace), (word) => {
      taken += 1;
      setText((t) => t + word);
      setWords(taken);
      return taken < budget;
    });
  };

  // A second run would abort the live controller and leave the old pump to report a status the
  // new one has already moved past, so a reader scrolling back into a stream in flight is left to
  // watch it — which is what they wanted anyway.
  useAutoplay((mode) => {
    if (engine.status === "loading") return;
    stream(Number.POSITIVE_INFINITY, mode === "settle" ? 0 : PACE);
  });

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={engine.status === "error" ? "destructive" : "secondary"}>
          {engine.status}
        </Badge>
        <Show when={engine.error !== null}>
          <span className="text-destructive text-xs">{engine.error}</span>
        </Show>
        <Show when={words > 0}>
          <span className="text-muted-foreground text-xs">{words} pulled</span>
        </Show>
      </div>

      <p className="min-h-20 rounded-md border bg-muted/40 p-3 text-sm">
        <Show fallback={<span className="text-muted-foreground">Nothing pulled yet.</span>} when={text.length > 0}>
          {text}
        </Show>
      </p>

      <ButtonGroup aria-label="Stream controls">
        <Button onClick={() => stream(Number.POSITIVE_INFINITY)} size="sm" variant="outline">
          Stream
        </Button>
        {/* A budget is not a second machine: the same run stops itself and the source is aborted. */}
        <Button onClick={() => stream(5)} size="sm" variant="outline">
          First five
        </Button>
        <Button
          disabled={engine.status !== "loading"}
          onClick={engine.cancel}
          size="sm"
          variant="outline"
        >
          Cancel
        </Button>
      </ButtonGroup>
    </div>
  );
}
