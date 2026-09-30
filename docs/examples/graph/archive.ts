"use client";

import { engine } from "@kanzo-tech/ui/analytics";
import { useEffect, useState } from "react";
import { open, type Corpus } from "@fossil-lang/corpus";

export { ARCHIVE_KINDS } from "@/example/archive";

/**
 * The archive the workspace showcase draws, as `fossil/1` — written by fossil's executor through
 * `showcases/workspace/corpus/build-corpus.mjs`. Prefixed, because a path handed to DuckDB is not.
 */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

let opening: Promise<Corpus> | null = null;

/**
 * The opening of the archive, for `GraphRoot`'s `corpus` — the promise, so the root says it is
 * opening until it settles and reports a failure through `onFailure`. One open for the page: every
 * preview is one corpus on the page's one engine. `null` on the server, where there is no engine.
 */
export function useArchive(): Promise<Corpus> | null {
  const [corpus, setCorpus] = useState<Promise<Corpus> | null>(null);
  useEffect(() => {
    opening ??= engine().then((e) => open(`${window.location.origin}${ARCHIVE}`, { engine: e }));
    setCorpus(opening);
  }, []);
  return corpus;
}
