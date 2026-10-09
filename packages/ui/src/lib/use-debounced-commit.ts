"use client";

import { useEffect, useRef, useState } from "react";

export interface DebouncedCommit<T, R = void> {
  /** What the control shows: the last thing typed until the value it commits to comes back. */
  draft: T;
  /** A keystroke. Updates `draft` now and commits after `delay`, restarting the wait each time. */
  change: (next: T) => void;
  /** Commits a pending draft immediately. Call it on blur; it does nothing when nothing is pending. */
  flush: () => void;
  /**
   * Commits `next` now and drops anything pending — a pick supersedes typing. Answers what
   * `onCommit` answered, so a caller can wait on the write its decision made.
   */
  commit: (next: T) => R;
  /**
   * Drops a pending draft without committing it, and leaves `draft` showing it until the owner's
   * value next changes. For an owner whose own write supersedes the draft: cancel, then write once.
   */
  cancel: () => void;
}

/**
 * A control that keeps what is being typed to itself and tells its owner once typing pauses.
 *
 * For an owner that is expensive to write to — a form model that revalidates, a request, a
 * document that re-renders — and a control that would otherwise write on every keystroke. `draft`
 * follows `value` whenever nothing is pending, so a change made elsewhere (a reset, another
 * editor) still lands in the control, and a change made while the user is typing does not.
 *
 * Nothing is committed on unmount: a cleanup that commits also commits in Strict Mode's
 * mount–unmount–mount, and the owner then hears a value nobody typed. `flush` on blur is what
 * keeps the last characters from being lost when the control goes away before the timer fires.
 *
 * An owner that writes the same value itself — a save that replaces the field the user is typing in
 * — calls `cancel` and then writes once. `flush` first would be two writes whose correctness rests
 * on the second landing after the first.
 *
 * `onCommit` may answer a promise — the write — which `commit` hands back. A commit after the pause or
 * on `flush` has nobody to hand it to, so the owner reports its failure (a mutation's `onError`), as
 * it does for every write.
 *
 * @example
 * const { draft, change, flush } = useDebouncedCommit(value, onChange);
 * <input value={draft} onChange={(e) => change(e.target.value)} onBlur={flush} />
 */
export function useDebouncedCommit<T, R = void>(
  value: T,
  onCommit: (next: T) => R,
  delay = 250
): DebouncedCommit<T, R> {
  const [state, setState] = useState({ draft: value, dirty: false, seen: value });

  // Adopt the owner's value during render rather than in an effect, so the control never paints
  // a frame of the old value — and only when the user is not mid-word.
  if (!Object.is(state.seen, value)) {
    setState({ draft: state.dirty ? state.draft : value, dirty: state.dirty, seen: value });
  }

  const latest = useRef(onCommit);
  useEffect(() => {
    latest.current = onCommit;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ value: T } | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: T): R => {
    clearTimeout(timer.current);
    pending.current = null;
    setState((s) => ({ ...s, draft: next, dirty: false }));
    return latest.current(next);
  };

  /** A commit nobody awaits: the pause's, or `flush`'s. */
  const unawaited = (next: T) => {
    const written = commit(next) as unknown;
    if (typeof (written as PromiseLike<unknown> | null)?.then === "function") {
      // Reported by the owner, whose write it is (see above); unhandled, it would be reported twice.
      (written as PromiseLike<unknown>).then(undefined, () => undefined);
    }
  };

  const change = (next: T) => {
    setState((s) => ({ ...s, draft: next, dirty: true }));
    pending.current = { value: next };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current) unawaited(pending.current.value);
    }, delay);
  };

  const flush = () => {
    if (pending.current) unawaited(pending.current.value);
  };

  const cancel = () => {
    clearTimeout(timer.current);
    pending.current = null;
    setState((s) => ({ ...s, dirty: false }));
  };

  return { draft: state.draft, change, flush, commit, cancel };
}
