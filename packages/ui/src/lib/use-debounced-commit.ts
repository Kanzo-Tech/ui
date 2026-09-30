"use client";

import { useEffect, useRef, useState } from "react";

export interface DebouncedCommit<T> {
  /** What the control shows: the last thing typed until the value it commits to comes back. */
  draft: T;
  /** A keystroke. Updates `draft` now and commits after `delay`, restarting the wait each time. */
  change: (next: T) => void;
  /** Commits a pending draft immediately. Call it on blur; it does nothing when nothing is pending. */
  flush: () => void;
  /** Commits `next` now and drops anything pending — a pick supersedes typing. */
  commit: (next: T) => void;
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
 * @example
 * const { draft, change, flush } = useDebouncedCommit(value, onChange);
 * <input value={draft} onChange={(e) => change(e.target.value)} onBlur={flush} />
 */
export function useDebouncedCommit<T>(
  value: T,
  onCommit: (next: T) => void,
  delay = 250
): DebouncedCommit<T> {
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

  const commit = (next: T) => {
    clearTimeout(timer.current);
    pending.current = null;
    setState((s) => ({ ...s, draft: next, dirty: false }));
    latest.current(next);
  };

  const change = (next: T) => {
    setState((s) => ({ ...s, draft: next, dirty: true }));
    pending.current = { value: next };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current) commit(pending.current.value);
    }, delay);
  };

  const flush = () => {
    if (pending.current) commit(pending.current.value);
  };

  return { draft: state.draft, change, flush, commit };
}
