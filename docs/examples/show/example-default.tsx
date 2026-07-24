"use client";

import { Button, Show, Spinner } from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  const [ready, setReady] = useState(true);

  return (
    <div className="flex flex-col items-center gap-4">
      <Show fallback={<Spinner />} when={ready}>
        <p className="text-muted-foreground text-sm">The content is ready.</p>
      </Show>
      <Button onClick={() => setReady((value) => !value)} variant="outline">
        Toggle
      </Button>
    </div>
  );
}
