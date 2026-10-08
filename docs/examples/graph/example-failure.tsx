"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";
import { DiagnosticList, Problem, Show, type ProblemCopy } from "@kanzo-tech/ui";
import { engine } from "@kanzo-tech/ui/analytics";
import { attach } from "@fossil-lang/corpus";

/** What a host says for a failure, keyed on its `code` — fossil's and the graph's alike. */
function copy(code: string): ProblemCopy | undefined {
  if (code === "graph/no-webgl") return { title: "This browser cannot draw the graph." };
  if (code === "corpus/unreadable") return { title: "The corpus is not where it was said to be." };
  return undefined;
}

/**
 * A corpus that is not there. fossil's `attach` refuses it with its coded `corpus/unreadable`, the host
 * routes that to the same handler it gives the root's `onFailure`, and `Problem` draws it: the
 * host's title where `copy` has one for the code, fossil's own message as the detail. The root is
 * never handed a catalog, so it stays `none` over an empty canvas.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const missing = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/nowhere`;
    engine()
      .then((e) => attach("nowhere", { engine: e, url: missing }))
      .catch(setFailure);
  }, []);
  return (
    <div className="flex h-72 w-full flex-col gap-2">
      <GraphRoot coordinator={null} from={null} onFailure={setFailure}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <div className="absolute inset-0 grid place-items-center p-6">
              <DiagnosticList className="max-w-md">
                <Problem copy={copy} error={failure} />
              </DiagnosticList>
            </div>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
