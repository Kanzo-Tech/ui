"use client";

import { overdueQuests } from "@/example/quests";
import { Button, Show, Spinner } from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  const [loaded, setLoaded] = useState(true);

  return (
    <div className="flex flex-col items-center gap-4">
      <Show fallback={<Spinner />} when={loaded}>
        <p className="text-muted-foreground text-sm">
          {overdueQuests().length} contracts are afield and past their due date.
        </p>
      </Show>
      <Button onClick={() => setLoaded((value) => !value)} variant="outline">
        Reload the board
      </Button>
    </div>
  );
}
