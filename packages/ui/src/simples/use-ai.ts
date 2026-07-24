"use client";

// Headless AI-assist engine — the shared streaming machinery behind inline ghost completion
// (`CodeEditor`'s `complete` prop, via `useCompletion`) and a composed candidate menu (a
// `Popover` + `useSuggestions`). Domain-free and source-agnostic: a consumer passes a function
// returning an async iterable and cancels it with an `AbortSignal`. This file imports **no**
// `@codemirror/*`, which is what keeps the hooks in the root barrel while the CodeMirror ghost
// surface stays behind the `/editor` peer boundary.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Suggestion } from "./types.js";

export type { Suggestion };

/** The continuation is meant to be appended verbatim. The only safety net: if the model
 * restated the whole value first, drop that one unambiguous full-value echo — no
 * character-level surgery, which used to mangle coincidental overlaps. */
export function cleanGhost(base: string, cont: string): string {
  const b = base.trimEnd();
  if (b && cont.toLowerCase().startsWith(b.toLowerCase())) return cont.slice(b.length);
  return cont;
}

const message = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export type AiStatus = "idle" | "streaming" | "error";

export interface AiStream<T> {
  /** Abort any prior stream, open a fresh iterator on a new controller. */
  start: (source: (signal: AbortSignal) => AsyncIterable<T>) => void;
  /** Re-open the iterator on the SAME controller — a retry when the source ran dry. */
  restart: () => void;
  /** Serialized single-consumer pull. Null on exhaust / abort / throw; sets `error`
   *  status only when the stream was not aborted. */
  next: () => Promise<T | null>;
  /** Pause: status → idle, keep the iterator (a later `next()` resumes it). */
  idle: () => void;
  /** Abort the controller and drop the iterator. */
  abort: () => void;
  signal: () => AbortSignal | undefined;
  status: AiStatus;
  error: string | null;
}

/** The shared engine. `idle` (keep the iterator) vs `abort` (drop it) is what lets both
 *  consumers — a resumable suggestion window and a per-keystroke completion — reuse it. */
export function useAiStream<T>(errorText = "Something went wrong"): AiStream<T> {
  const [status, setStatus] = useState<AiStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<AiStatus>("idle");
  const ctrl = useRef<AbortController>(undefined);
  const iter = useRef<AsyncIterator<T> | null>(null);
  const source = useRef<((signal: AbortSignal) => AsyncIterable<T>) | null>(null);
  const pump = useRef<Promise<unknown>>(Promise.resolve());
  const errRef = useRef(errorText);
  errRef.current = errorText;

  const set = useCallback((s: AiStatus, e: string | null = null) => {
    statusRef.current = s;
    setStatus(s);
    setError(e);
  }, []);

  useEffect(() => () => ctrl.current?.abort(), []);

  const start = useCallback(
    (src: (signal: AbortSignal) => AsyncIterable<T>) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      source.current = src;
      iter.current = src(c.signal)[Symbol.asyncIterator]();
      set("streaming");
    },
    [set],
  );

  const restart = useCallback(() => {
    const c = ctrl.current;
    if (!source.current || !c || c.signal.aborted) return;
    iter.current = source.current(c.signal)[Symbol.asyncIterator]();
  }, []);

  const next = useCallback((): Promise<T | null> => {
    const run = pump.current.then(async (): Promise<T | null> => {
      const it = iter.current;
      const signal = ctrl.current?.signal;
      if (!it || signal?.aborted) return null;
      let res: IteratorResult<T>;
      try {
        res = await it.next();
      } catch (e) {
        if (!signal?.aborted) set("error", message(e, errRef.current));
        iter.current = null;
        return null;
      }
      if (signal?.aborted) return null;
      if (res.done) {
        iter.current = null;
        return null;
      }
      return res.value;
    });
    pump.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, [set]);

  const idle = useCallback(() => {
    if (statusRef.current !== "error") set("idle");
  }, [set]);

  const abort = useCallback(() => {
    ctrl.current?.abort();
    iter.current = null;
  }, []);

  const signal = useCallback(() => ctrl.current?.signal, []);

  return { start, restart, next, idle, abort, signal, status, error };
}

// ── useCompletion — inline continuation (bring your own input) ────────────────

export interface UseCompletionOptions {
  /** Streaming inline completion — yields continuation chunks; honour the `AbortSignal`. */
  complete: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  debounceMs?: number;
  minLength?: number;
}

export interface Completion {
  ghost: string;
  hasGhost: boolean;
  status: AiStatus;
  error: string | null;
  /** Request after a debounce — the typing path. */
  setValue: (text: string) => void;
  /** Request immediately — the ✨ button path. */
  request: (text: string) => void;
  /** Return the current ghost for the caller to insert, then clear. */
  accept: () => string;
  dismiss: () => void;
  clear: () => void;
}

/** Ghost-text completion that does NOT own the input value — the caller's editor owns the
 *  text; `accept()` returns the string to insert. */
export function useCompletion(options: UseCompletionOptions): Completion {
  const engine = useAiStream<string>("Couldn’t complete");
  const [ghost, setGhost] = useState("");

  const opts = useRef(options);
  opts.current = options;

  const askTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = useCallback(() => {
    clearTimeout(askTimer.current);
    engine.abort();
    setGhost("");
  }, [engine]);

  // Each run captures its own text (the `cleanGhost` base) and its own signal, so a stale
  // loop superseded by a newer request drops its trailing chunk instead of writing it.
  const run = useCallback(
    (text: string) => {
      engine.start((signal) => opts.current.complete(text, signal));
      const mine = engine.signal();
      let raw = "";
      void (async () => {
        for (;;) {
          const chunk = await engine.next();
          if (mine?.aborted) return;
          if (chunk == null) break;
          raw += chunk;
          setGhost(cleanGhost(text, raw));
        }
        if (!mine?.aborted) engine.idle();
      })();
    },
    [engine],
  );

  const request = useCallback(
    (text: string) => {
      stop();
      if (text.trim().length < (opts.current.minLength ?? 4)) return;
      run(text);
    },
    [run, stop],
  );

  const setValue = useCallback(
    (text: string) => {
      stop();
      if (text.trim().length < (opts.current.minLength ?? 4)) return;
      askTimer.current = setTimeout(() => run(text), opts.current.debounceMs ?? 350);
    },
    [run, stop],
  );

  const accept = useCallback((): string => {
    const text = ghost;
    stop();
    return text;
  }, [ghost, stop]);

  useEffect(() => () => clearTimeout(askTimer.current), []);

  return {
    ghost,
    hasGhost: ghost.length > 0,
    status: engine.status,
    error: engine.error,
    setValue,
    request,
    accept,
    dismiss: stop,
    clear: stop,
  };
}

// ── useSuggestions — a windowed, deduped candidate list ───────────────────────

/** Case-insensitive key for deduping suggestion values. */
const norm = (v: string) => v.trim().toLowerCase();

export interface UseSuggestionsOptions {
  suggest: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
  /** Current values — suggestions equal to one of these (case-insensitive) are dropped. */
  existing: string[];
  /** How many suggestions to keep on screen; dismissing one refills to this. */
  window?: number;
}

export interface Suggestions {
  items: Suggestion[];
  status: AiStatus;
  error: string | null;
  loading: boolean;
  /** Idempotent within an open-cycle — cached across reopen until `cancel`. */
  start: () => void;
  cancel: () => void;
  dismiss: (index: number) => void;
}

export function useSuggestions(options: UseSuggestionsOptions): Suggestions {
  const engine = useAiStream<Suggestion>("Couldn’t load suggestions");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const opts = useRef(options);
  opts.current = options;

  const started = useRef(false); // fetch once per open-cycle, cache across reopen
  const seen = useRef<Set<string>>(new Set()); // existing values + everything already shown
  const shown = useRef(0); // live count of visible rows (drives the fill loop)
  const filling = useRef(false); // serialize pulls — one iterator, one consumer
  const retried = useRef(false); // one fresh stream when the first runs dry

  // Next unique candidate, restarting the source once when it runs dry, or null when it can
  // give no more (also on abort / error).
  const pull = useCallback(async (): Promise<Suggestion | null> => {
    for (;;) {
      const v = await engine.next();
      if (v == null) {
        if (engine.signal()?.aborted || retried.current) return null;
        retried.current = true;
        engine.restart();
        continue;
      }
      const k = norm(v.value);
      if (!k || seen.current.has(k)) continue;
      seen.current.add(k);
      return v;
    }
  }, [engine]);

  const fill = useCallback(async () => {
    if (filling.current) return;
    filling.current = true;
    setLoading(true);
    try {
      while (shown.current < (opts.current.window ?? 3)) {
        const item = await pull();
        if (!item || engine.signal()?.aborted) break;
        shown.current += 1;
        setItems((prev) => [...prev, item]);
      }
    } finally {
      filling.current = false;
      setLoading(false);
      engine.idle();
    }
  }, [engine, pull]);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    seen.current = new Set(opts.current.existing.map(norm).filter(Boolean));
    retried.current = false;
    shown.current = 0;
    setItems([]);
    engine.start((signal) => opts.current.suggest(signal));
    void fill();
  }, [engine, fill]);

  const cancel = useCallback(() => {
    engine.abort();
    started.current = false;
    setLoading(false);
  }, [engine]);

  const dismiss = useCallback(
    (index: number) => {
      setItems((prev) => prev.filter((_, i) => i !== index));
      shown.current -= 1;
      void fill();
    },
    [fill],
  );

  return {
    items,
    status: engine.status,
    error: engine.error,
    loading,
    start,
    cancel,
    dismiss,
  };
}
