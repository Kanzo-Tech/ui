"use client";

import { Badge, Button, ButtonGroup, Show, useAiStream } from "@kanzo-tech/ui";
import { useState } from "react";

// A stub source. A product would open a `fetch` here; the engine only ever sees an async
// iterable and an `AbortSignal`, so a hard-coded array is a legitimate implementation.
const WORDS =
  "The engine owns the iterator, the abort controller and the status — not the markup, and not your value.".split(
    /(?<=\s)/,
  );

async function* source(signal: AbortSignal) {
  for (const word of WORDS) {
    await new Promise((r) => setTimeout(r, 90));
    if (signal.aborted) return;
    yield word;
  }
}

export default function Example() {
  const engine = useAiStream<string>("Couldn’t reach the stub");
  const [text, setText] = useState("");

  // One consumer, one loop: `next()` serializes pulls, so this is the whole read side.
  const pump = async () => {
    for (;;) {
      const chunk = await engine.next();
      if (chunk == null) break;
      setText((t) => t + chunk);
    }
    engine.idle();
  };

  const stream = () => {
    setText("");
    engine.start(source);
    void pump();
  };

  const again = () => {
    engine.restart();
    void pump();
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={engine.status === "error" ? "destructive" : "secondary"}>
          {engine.status}
        </Badge>
        <Show when={engine.error !== null}>
          <span className="text-destructive text-xs">{engine.error}</span>
        </Show>
      </div>

      <p className="min-h-20 rounded-md border bg-muted/40 p-3 text-sm">
        <Show fallback={<span className="text-muted-foreground">Nothing pulled yet.</span>} when={text.length > 0}>
          {text}
        </Show>
      </p>

      <ButtonGroup aria-label="Stream controls">
        <Button onClick={stream} size="sm" variant="outline">
          Start
        </Button>
        {/* `restart` is a no-op once the controller is aborted — only a drained live stream. */}
        <Button
          disabled={engine.status === "streaming" || engine.signal()?.aborted !== false}
          onClick={again}
          size="sm"
          variant="outline"
        >
          Restart
        </Button>
        <Button
          disabled={engine.status !== "streaming"}
          onClick={engine.abort}
          size="sm"
          variant="outline"
        >
          Abort
        </Button>
      </ButtonGroup>
    </div>
  );
}
