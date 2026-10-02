"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, GraphError, GraphRoot, useGraphState } from "@kanzo-tech/graph";
import { Alert, AlertDescription, AlertTitle, Badge, Show } from "@kanzo-tech/ui";
import { engine } from "@kanzo-tech/ui/analytics";
import { open, type Corpus } from "@fossil-lang/corpus";

/** What a host says for a failure, keyed on its `code` — fossil's and the graph's alike. */
function sentence(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (error instanceof GraphError && code === "graph/no-webgl") return "This browser cannot draw the graph.";
  if (code === "corpus/unreadable") return "The corpus is not where it was said to be.";
  return error instanceof Error ? error.message : String(error);
}

function Status() {
  const status = useGraphState((s) => s.status);
  return <Badge variant={status === "failed" ? "destructive" : "outline"}>status · {status}</Badge>;
}

/**
 * A corpus that is not there. `open` refuses it with fossil's coded `corpus/unreadable`, the root
 * hands that to `onFailure` as it was thrown and reports `status: "failed"`, and the host decides
 * what to say by the code.
 */
export default function Example() {
  const [corpus, setCorpus] = useState<Promise<Corpus> | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const missing = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/nowhere`;
    const opening = engine().then((e) => open(missing, { engine: e }));
    // The root reports the rejection; this only keeps an opening StrictMode discarded from going unhandled.
    opening.catch(() => {});
    setCorpus(opening);
  }, []);
  const code = (failure as { code?: unknown } | null)?.code;
  return (
    <div className="flex h-72 w-full flex-col gap-2">
      <GraphRoot corpus={corpus} onFailure={setFailure}>
        <Status />
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
