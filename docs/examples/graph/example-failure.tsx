"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";
import { DiagnosticList, Problem, Show, type ProblemDescription } from "@kanzo-tech/ui";
import { engine } from "@kanzo-tech/mosaic/engine";
import { attachWritten } from "@/lib/attach-graph";

/** What a host says for a failure, keyed on its `code` — graphar's and the graph's alike. */
function describe(code: string): ProblemDescription | undefined {
  if (code === "graph/no-webgl") return { title: "This browser cannot draw the graph." };
  if (code === "unreadable") return { title: "The graph is not where it was said to be." };
  return undefined;
}

/**
 * A graph that is not there. `attachGraph` refuses it with its coded `unreadable` (a `GraphArError`), the host
 * routes that to the same handler it gives the root's `onFailure`, and `Problem` draws it: the
 * host's title where `describe` has one for the code, the attach's own message as the detail. The root is
 * never handed a catalog, so it stays `none` over an empty canvas.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const missing = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/nowhere`;
    engine()
      .then((e) => attachWritten(e, "nowhere", missing))
      .catch(setFailure);
  }, []);
  return (
    <div className="flex h-72 w-full flex-col gap-2">
      <GraphRoot engine={null} from={null} onFailure={setFailure}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <div className="absolute inset-0 grid place-items-center p-6">
              <DiagnosticList className="max-w-md">
                <Problem describe={describe} error={failure} />
              </DiagnosticList>
            </div>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
