"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";
import { evaluate, locationOf } from "./registry";
import type { HistoryAction } from "./types";

type Router = ReturnType<typeof useNextRouter>;

/**
 * `next/navigation`'s `useRouter`, with `push` and `replace` consulting the blockers first.
 *
 * It wraps the instance Next hands every component, and nothing below it: `back`, `forward`,
 * `refresh` and `prefetch` are Next's own. `back` and `forward` are traversals, which the root's
 * `navigate` listener already sees before they commit; `refresh` does not leave the page.
 */
export function useRouter(): Router {
  const router = useNextRouter();

  return useMemo(() => {
    const guarded =
      (action: HistoryAction, go: Router["push"]): Router["push"] =>
      (href, options) => {
        const verdict = evaluate({
          current: locationOf(location.href),
          next: locationOf(href, location.href),
          action,
        });
        if (verdict === false) return go(href, options);
        if (verdict === true) return;
        void verdict.then((block) => {
          if (!block) go(href, options);
        });
      };

    return {
      ...router,
      push: guarded("PUSH", router.push),
      replace: guarded("REPLACE", router.replace),
    };
  }, [router]);
}
