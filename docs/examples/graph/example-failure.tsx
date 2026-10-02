"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, GraphError, GraphRoot } from "@kanzo-tech/graph";
import { Alert, AlertDescription, AlertTitle, Show } from "@kanzo-tech/ui";
import { engine } from "@kanzo-tech/ui/analytics";
import { open } from "@fossil-lang/corpus";

/** What a host says for a failure, keyed on its `code` — fossil's and the graph's alike. */
function sentence(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (error instanceof GraphError && code === "graph/no-webgl") return "This browser cannot draw the graph.";
  if (code === "corpus/unreadable") return "The corpus is not where it was said to be.";
  return error instanceof Error ? error.message : String(error);
}

/**
 * A corpus that is not there. fossil's `open` refuses it with its coded `corpus/unreadable`, the host
 * routes that to the same handler it gives the root's `onFailure`, and decides what to say by the
 * code. The root is never handed a catalog, so it stays `none` over an empty canvas.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const missing = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/nowhere`;
    engine()
      .then((e) => open("nowhere", { engine: e, url: missing }))
      .catch(setFailure);
  }, []);
  const code = (failure as { code?: unknown } | null)?.code;
  return (
    <div className="flex h-72 w-full flex-col gap-2">
      <GraphRoot coordinator={null} from={null} onFailure={setFailure}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <div className="absolute inset-0 grid place-items-center p-6">
              <Alert className="max-w-sm" variant="destructive">
                <AlertTitle>{typeof code === "string" ? code : "Failed"}</AlertTitle>
                <AlertDescription>{sentence(failure)}</AlertDescription>
              </Alert>
            </div>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
