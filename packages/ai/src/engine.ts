"use client";

// The machinery behind `Assist`, and none of it is public. A field offers a **proposal** — text the
// reader may take — and this file gets proposals out of a stream and keeps them honest while the
// reader types: one engine, the inline continuation (whose rules are `./offers.ts`), and the
// candidate list.
//
// A field's proposal is the Task's `Proposal` of a string: a continuation's `target` inserts at the
// caret, a candidate's replaces the value, and a list's adds an item. There is no second type.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type OfferEvent, type Offers, askable, offers as createOffers } from "./offers.js";
import type { Proposal } from "./task/index.js";

/**
 * What happened to a proposal, for a host that learns from it (HAX G13). The lifecycle VS Code's
 * inline completions report, in one callback: it was **shown**, taken whole (**accepted**) or a word
 * at a time (**partial**), turned down by the reader (**rejected**: Esc, or a candidate's ✕), or
 * left to die because they typed something else (**ignored**).
 */
export interface AssistEvent {
  kind: "shown" | "accepted" | "partial" | "rejected" | "ignored";
  /** The field's accessible name — which field it was. */
  field: string;
  /**
   * What was offered: text the model wrote from the reader's text. Present only where the provider
   * opts in with `includeText`; an event is otherwise a count of what happened, and carries no text.
   */
  proposal?: Proposal<string>;
}

/** Where a request has got to. Internal: no surface exposes it, they draw from it. */
export type Status = "idle" | "loading" | "ready" | "error";

// ── The engine ───────────────────────────────────────────────────────────────

/**
 * Open a source and pull it to the end, handing each value to `each`; `false` from `each` stops it.
 * A new run supersedes the one in flight, and resolves to what happened to **this** run, so a loop
 * that outlives its render never reads a stale status.
 */
export function useStream<T>() {
  const [status, setStatus] = useState<Status>("idle");
  /** What the source threw, as thrown, while `status` is `"error"`. */
  const [error, setError] = useState<unknown>(undefined);
  const statusRef = useRef<Status>("idle");
  const ctrl = useRef<AbortController>(undefined);

  const set = useCallback((s: Status, e?: unknown) => {
    statusRef.current = s;
    setStatus(s);
    setError(e);
  }, []);

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(
    (src: (signal: AbortSignal) => AsyncIterable<T>, each: (value: T) => boolean | void) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      set("loading");

      return (async (): Promise<Status> => {
        try {
          const it = src(c.signal)[Symbol.asyncIterator]();
          for (;;) {
            const res = await it.next();
            if (c.signal.aborted) return "idle";
            if (res.done) break;
            if (each(res.value) === false) {
              c.abort();
              break;
            }
          }
        } catch (e) {
          // A cancellation is not a failure to report — the caller asked for it.
          if (c.signal.aborted) return "idle";
          if (!c.signal.aborted) c.abort();
          set("error", e);
          return "error";
        }
        if (ctrl.current === c) set("ready");
        return "ready";
      })();
    },
    [set],
  );

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    set("idle");
  }, [set]);

  const reset = useCallback(() => {
    if (statusRef.current !== "loading") set("idle");
  }, [set]);

  return useMemo(() => ({ run, cancel, reset, status, error }), [cancel, error, reset, run, status]);
}

/**
 * Run `paint` at most once a frame, and once more on `flush()`. A token stream arrives faster than
 * the display refreshes, so a `setState` per chunk renders work nobody sees.
 */
function coalesce(paint: () => void) {
  let frame: number | undefined;
  let queued = false;
  const run = () => {
    queued = true;
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      queued = false;
      paint();
    });
  };
  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    queued = false;
  };
  const flush = () => {
    const pending = queued;
    cancel();
    if (pending) paint();
  };
  return Object.assign(run, { flush, cancel });
}

// ── The continuation: one offer at the caret, with alternatives ──────────────

export type Trigger = "invoked" | "automatic";

export interface ContinuationRequest {
  value: string;
  position: number;
  trigger: Trigger;
  /** Continuations already offered at this point; an alternative must differ from them. */
  avoid: string[];
  signal: AbortSignal;
}

/**
 * Ghost text that does not own the value: the field owns it and performs the insertion. The rules —
 * an offer survives typing that agrees with it, alternatives at one point — are `./offers.ts`; this
 * runs them against a stream, a debounce and the frame.
 */
export function useContinuation(options: {
  source: (request: ContinuationRequest) => AsyncIterable<string>;
  onEvent: (kind: AssistEvent["kind"], proposal: Proposal<string>) => void;
  debounceMs?: number;
}) {
  const { run, cancel, status, error } = useStream<string>();
  const [ghost, setGhost] = useState("");
  const opts = useRef(options);
  opts.current = options;
  const offers = useRef<Offers>(undefined);
  offers.current ??= createOffers();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tell = useCallback((events: OfferEvent[] | null) => {
    for (const e of events ?? []) opts.current.onEvent(e.kind, e.proposal);
  }, []);

  const painter = useRef<ReturnType<typeof coalesce>>(undefined);
  painter.current ??= coalesce(() => {
    setGhost(offers.current!.ghost());
    tell(offers.current!.show());
  });

  /** Stop asking and painting, and clear the ghost. */
  const halt = useCallback(
    (events: OfferEvent[] | null) => {
      clearTimeout(timer.current);
      painter.current?.cancel();
      tell(events);
      cancel();
      setGhost("");
    },
    [cancel, tell],
  );

  const start = useCallback(
    (trigger: Trigger) => {
      const o = offers.current!;
      const { offer, avoid } = o.open();
      const { value, caret: position } = o;
      void run(
        (signal) => opts.current.source({ value, position, trigger, avoid, signal }),
        (chunk) => {
          if (!o.arrive(offer, chunk)) return false;
          painter.current?.();
        },
      ).then((outcome) => {
        if (!o.end(offer, outcome === "error")) return;
        if (outcome === "ready") return painter.current?.flush();
        painter.current?.cancel();
        if (outcome === "error") setGhost("");
      });
    },
    [run],
  );

  /** The field changed. Ask after a debounce — unless the offer on the table survives it. */
  const setValue = useCallback(
    (value: string, position = value.length) => {
      const o = offers.current!;
      const lost = o.type(value, position);
      if (!lost) return setGhost(o.ghost());
      halt(lost);
      if (askable(value)) timer.current = setTimeout(() => start("automatic"), opts.current.debounceMs ?? 350);
    },
    [halt, start],
  );

  /** Ask now — the ✨, and Alt+] past the last alternative. */
  const ask = useCallback(
    (value: string, position = value.length) => {
      const lost = offers.current!.invoke(value, position);
      if (lost) halt(lost);
      clearTimeout(timer.current);
      if (askable(value)) start("invoked");
    },
    [halt, start],
  );

  /** Move between alternatives; past the last one, ask for another. */
  const cycle = useCallback(
    (step: 1 | -1) => {
      const o = offers.current!;
      const moved = o.turn(step);
      if (moved === "more") return ask(o.value, o.caret);
      if (!moved) return;
      setGhost(o.ghost());
      painter.current?.();
    },
    [ask],
  );

  const settle = useCallback(
    (kind: "accepted" | "partial", text: string) => {
      const events = offers.current!.take(kind, text);
      if (kind === "accepted") halt(events);
      else tell(events);
    },
    [halt, tell],
  );

  const dismiss = useCallback((why?: "rejected" | "ignored") => halt(offers.current!.drop(why)), [halt]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      painter.current?.cancel();
    },
    [],
  );

  return { ghost, status, error, setValue, ask, cycle, settle, dismiss };
}

// ── The candidates: N whole values, deduped ──────────────────────────────────

const norm = (v: string) => v.trim().toLowerCase();

/**
 * A streamed list of whole values, deduped against what the field already holds. A budget rather
 * than a window: nothing refills when one is taken or dismissed.
 */
export function useCandidates(options: {
  source: (request: { existing: string[]; signal: AbortSignal }) => AsyncIterable<Proposal<string>>;
  existing: string[];
  onEvent: (kind: AssistEvent["kind"], proposal: Proposal<string>) => void;
  limit?: number;
}) {
  const { run, cancel: abort, reset, status, error } = useStream<Proposal<string>>();
  const [items, setItems] = useState<Proposal<string>[]>([]);
  const shown = useRef<Proposal<string>[]>([]);
  const opts = useRef(options);
  opts.current = options;

  const put = useCallback((next: Proposal<string>[]) => {
    shown.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(() => {
    const { existing, limit = 6, source } = opts.current;
    const seen = new Set(existing.map(norm).filter(Boolean));
    const taken: Proposal<string>[] = [];
    put([]);
    void run(
      (signal) => source({ existing, signal }),
      (item) => {
        const key = norm(item.value);
        if (!key || seen.has(key)) return true;
        seen.add(key);
        taken.push(item);
        put([...taken]);
        opts.current.onEvent("shown", item);
        return taken.length < limit;
      },
    );
  }, [put, run]);

  /** The ✨: a first set, a different set, or a retry — never inert, except while loading. */
  const press = useCallback(() => {
    if (status === "loading") return;
    refresh();
  }, [refresh, status]);

  const remove = useCallback(
    (text: string, kind: "accepted" | "rejected") => {
      const key = norm(text);
      const item = shown.current.find((p) => norm(p.value) === key);
      if (item) opts.current.onEvent(kind, item);
      const next = shown.current.filter((p) => norm(p.value) !== key);
      put(next);
      // Nothing left of an answer is not an answer with nothing in it.
      if (next.length === 0) reset();
    },
    [put, reset],
  );

  const cancel = useCallback(() => {
    abort();
    put([]);
  }, [abort, put]);

  return { items, status, error, press, take: (t: string) => remove(t, "accepted"), dismiss: (t: string) => remove(t, "rejected"), cancel };
}
