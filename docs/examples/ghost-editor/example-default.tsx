"use client";

import { GhostEditor } from "@kanzo-tech/ui/editor";
import { useState } from "react";

// A canned continuation, streamed a few characters at a time. A real call site yields straight
// from a model response instead — the component only cares that it is an async iterable that
// honours the AbortSignal.
const CONTINUATION =
  " of hourly weather observations collected by AEMET stations across Spain, including" +
  " temperature, humidity and wind, published under an open licence.";

async function* complete(value: string, signal?: AbortSignal): AsyncIterable<string> {
  // Only complete once the sentence has been started — mirrors the min-length guard.
  if (!value.trim().toLowerCase().startsWith("a dataset")) return;
  let out = "";
  for (const ch of CONTINUATION) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 18));
    out += ch;
    yield out;
  }
}

export default function Example() {
  const [value, setValue] = useState<string | null>("A dataset");

  return (
    <div className="w-full max-w-md">
      <GhostEditor
        complete={complete}
        onChange={setValue}
        placeholder="Describe the dataset…"
        value={value}
      />
      <p className="mt-2 text-muted-foreground text-xs">
        Pause after “A dataset” — the grey continuation is a suggestion. Tab accepts, Esc
        dismisses.
      </p>
    </div>
  );
}
