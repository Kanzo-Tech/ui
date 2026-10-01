/**
 * TanStack Router's blocker vocabulary, name for name. The one shape that differs is the location:
 * TanStack hands `{ routeId, fullPath, params }`, and Next matches routes on the server only, so
 * what a client can honestly say about a destination is its URL.
 */

export type HistoryAction = "PUSH" | "REPLACE" | "BACK" | "FORWARD" | "GO";

export interface ShouldBlockFnLocation {
  href: string;
  pathname: string;
  search: string;
  hash: string;
}

export interface ShouldBlockFnArgs {
  current: ShouldBlockFnLocation;
  next: ShouldBlockFnLocation;
  action: HistoryAction;
}

export type ShouldBlockFn = (args: ShouldBlockFnArgs) => boolean | Promise<boolean>;

export interface UseBlockerOpts {
  shouldBlockFn: ShouldBlockFn;
  /** Ask the browser's own dialog on reload, close and the URL bar. `true` by default. */
  enableBeforeUnload?: boolean | (() => boolean);
  disabled?: boolean;
  withResolver?: boolean;
  /**
   * Called with what `shouldBlockFn` threw or rejected with, whole. A guard that fails does not
   * block: the navigation goes ahead, so a broken check never traps the person on the page.
   */
  onFailure?: (error: unknown) => void;
}

export type BlockerResolver =
  | {
      status: "blocked";
      current: ShouldBlockFnLocation;
      next: ShouldBlockFnLocation;
      action: HistoryAction;
      proceed: () => void;
      reset: () => void;
    }
  | {
      status: "idle";
      current: undefined;
      next: undefined;
      action: undefined;
      proceed: undefined;
      reset: undefined;
    };
