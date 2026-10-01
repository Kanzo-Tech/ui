"use client";

import { useEffect, useRef, useState } from "react";
import { register } from "./platform";
import type { BlockerResolver, ShouldBlockFnArgs, UseBlockerOpts } from "./types";

const IDLE: BlockerResolver = {
  status: "idle",
  current: undefined,
  next: undefined,
  action: undefined,
  proceed: undefined,
  reset: undefined,
};

/**
 * Blocks leaving the page while `shouldBlockFn` says so. TanStack Router's `useBlocker`, verbatim in
 * its options and its resolver; `/docs/design/navigation` is what differs and why.
 *
 * With `withResolver`, a navigation `shouldBlockFn` blocks is held — `status: "blocked"` — until
 * `proceed` lets it continue or `reset` stays. The dialog that asks is the product's.
 *
 * `enableBeforeUnload` is **not** derived from `shouldBlockFn`: the browser asks synchronously and
 * `shouldBlockFn` may not answer that way. Left at its default, a page carrying this hook is asked
 * about on every reload — which is why `disabled: !dirty` is the idiom, not `shouldBlockFn: () =>
 * dirty` alone.
 */
export function useBlocker(opts: UseBlockerOpts & { withResolver: true }): BlockerResolver;
export function useBlocker(opts: UseBlockerOpts & { withResolver?: false }): void;
export function useBlocker(opts: UseBlockerOpts): BlockerResolver | void;
export function useBlocker({
  shouldBlockFn,
  enableBeforeUnload = true,
  disabled = false,
  withResolver = false,
  onFailure,
}: UseBlockerOpts): BlockerResolver | void {
  const [resolver, setResolver] = useState<BlockerResolver>(IDLE);

  // The latest options, read at navigation time. Registering again whenever an inline function
  // changed identity would move this blocker to the end of the order on every render.
  const latest = useRef({ shouldBlockFn, enableBeforeUnload, onFailure });
  latest.current = { shouldBlockFn, enableBeforeUnload, onFailure };

  useEffect(() => {
    if (disabled) return;
    let pending: ((block: boolean) => void) | undefined;

    const ask = (args: ShouldBlockFnArgs) => {
      // A second navigation while the first is still being asked about: the first one stays.
      pending?.(true);
      let settle: (block: boolean) => void = () => {};
      const asked = new Promise<boolean>((resolve) => (settle = resolve));
      pending = settle;
      setResolver({
        status: "blocked",
        ...args,
        proceed: () => settle(false),
        reset: () => settle(true),
      });
      return asked.then((block) => {
        // Only the navigation still being asked about may put the resolver back to idle.
        if (pending === settle) {
          pending = undefined;
          setResolver(IDLE);
        }
        return block;
      });
    };

    const unregister = register({
      fn: (args) => {
        const failed = (error: unknown) => {
          latest.current.onFailure?.(error);
          return false;
        };
        let verdict: boolean | Promise<boolean>;
        try {
          verdict = latest.current.shouldBlockFn(args);
        } catch (error) {
          return failed(error);
        }
        if (verdict === false) return false;
        if (verdict === true) return withResolver ? ask(args) : true;
        return verdict.then((block) => (block && withResolver ? ask(args) : block), failed);
      },
      enableBeforeUnload: () => {
        const enabled = latest.current.enableBeforeUnload;
        return typeof enabled === "function" ? enabled() : enabled;
      },
    });

    return () => {
      unregister();
      pending?.(true);
    };
  }, [disabled, withResolver]);

  return resolver;
}
