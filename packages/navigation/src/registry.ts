import type { ShouldBlockFnArgs, ShouldBlockFnLocation } from "./types";

/**
 * The blockers on the page, and the one evaluation every door shares.
 *
 * Module state on purpose: the root's listeners and `/next`'s `Link` and `useRouter` must consult
 * the same list, and the build writes one file per module so both doors import this one rather than
 * each inlining a copy. No DOM here — `platform.ts` is the half that touches `window`.
 */

export interface Blocker {
  /**
   * `true` blocks, `false` lets it through; a promise is a decision still being made. It never
   * throws or rejects: `useBlocker` turns a failing guard into `false` and its `onFailure`, which is
   * why the three doors may `void` the verdict they wait on.
   */
  fn: (args: ShouldBlockFnArgs) => boolean | Promise<boolean>;
  enableBeforeUnload: () => boolean;
}

export const blockers: Blocker[] = [];

/**
 * One-shot passes for a navigation this package is replaying after `proceed`, so the replay is not
 * blocked a second time. TanStack's `ignoreNextBeforeUnload` and `skipBlockerNextPop`, in the two
 * places a replay reaches here.
 */
export const bypass = { navigate: false, beforeunload: false };

/**
 * Blockers in registration order, and the first that says `true` blocks.
 *
 * Synchronous for as long as every blocker answers synchronously, which is what lets a clean form
 * leave `Link` and `navigate` completely alone. A promise anywhere turns the rest of the walk into
 * one: the caller then has to cancel now and replay later, because both hooks it sits on demand a
 * synchronous `preventDefault()`.
 */
export function evaluate(args: ShouldBlockFnArgs): boolean | Promise<boolean> {
  const from = (start: number): boolean | Promise<boolean> => {
    const list = blockers.slice(start);
    for (const [offset, blocker] of list.entries()) {
      const verdict = blocker.fn(args);
      if (verdict === true) return true;
      if (verdict !== false) {
        return Promise.resolve(verdict).then((block) => (block ? true : from(start + offset + 1)));
      }
    }
    return false;
  };
  return from(0);
}

export function locationOf(url: string | URL, base?: string): ShouldBlockFnLocation {
  const { href, pathname, search, hash } = new URL(url, base);
  return { href, pathname, search, hash };
}
