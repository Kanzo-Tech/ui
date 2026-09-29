"use client";

import { open, type Corpus } from "@fossil-lang/corpus";
import { engine } from "@kanzo-tech/ui/analytics";
import { useEffect, useState } from "react";

/** The archive the workspace showcase draws — prefixed, because a path handed to DuckDB is not. */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

let opening: Promise<Corpus> | null = null;

/** One open for the page: four previews of one archive are one corpus on the page's one engine. */
export function useArchive(): { corpus: Corpus | null; unopened: string | null } {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [unopened, setUnopened] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    opening ??= engine().then((e) => open(`${window.location.origin}${ARCHIVE}`, { engine: e }));
    opening.then(
      (opened) => live && setCorpus(opened),
      (error: unknown) => live && setUnopened(error instanceof Error ? error.message : String(error)),
    );
    return () => {
      live = false;
    };
  }, []);
  return { corpus, unopened };
}
