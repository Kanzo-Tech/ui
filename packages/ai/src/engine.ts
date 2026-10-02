"use client";

// The machinery behind `Assist`, and none of it is public. A field offers a **proposal** — text the
// reader may take — and this file is everything about getting proposals out of a stream and keeping
// them honest while the reader types: one engine, the inline continuation, and the candidate list.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** A value the model offers a field. LSP 3.18's `InlineCompletionItem`, as a field needs it. */
export interface Proposal {
  text: string;
  /**
   * What taking it replaces, as `[from, to)` in the field's value: an empty range at the caret is a
   * continuation, the whole value is a replacement. Absent for a new item in a list field (tags),
   * where taking it adds rather than edits.
   */
  range?: [from: number, to: number];
  /** Why the model offered it. Shown as the candidate's tooltip. */
  rationale?: string;
}

/**
 * What happened to a proposal, for a host that learns from it (HAX G13). The lifecycle VS Code's
 * inline completions report, in one callback: it was **shown**, taken whole (**accepted**) or a word
 * at a time (**partial**), turned down by the reader (**rejected**: Esc, or a candidate's ✕), or
 * left to die because they typed something else (**ignored**).
 */
export interface AssistEvent {
  kind: "shown" | "accepted" | "partial" | "rejected" | "ignored";
  proposal: Proposal;
  /** The field's accessible name — which field it was. */
  field: string;
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

/**
 * The continuation is appended verbatim, with one safety net: a model that restated the value
 * before continuing gets that prefix dropped, and an echo still arriving renders as nothing until it
 * diverges — painting the value twice is worse than a few frames of nothing.
 */
export function cleanGhost(base: string, cont: string): string {
  const b = base.trimEnd();
  if (!b || !cont) return cont;
  const lower = { base: b.toLowerCase(), cont: cont.toLowerCase() };
  if (lower.cont.startsWith(lower.base)) return cont.slice(b.length);
  if (lower.base.startsWith(lower.cont)) return "";
  return cont;
}

// ── The continuation: one offer at the caret, with alternatives ──────────────

/** Below this there is not enough text to continue, so nothing is asked. */
export const MIN_CONTINUE_LENGTH = 4;

export type Trigger = "invoked" | "automatic";

export interface ContinuationRequest {
  value: string;
  position: number;
  trigger: Trigger;
  /** Continuations already offered at this point; an alternative must differ from them. */
  avoid: string[];
  signal: AbortSignal;
}

interface Offer {
  from: number;
  text: string;
  done: boolean;
}

/**
 * Ghost text that does not own the value: the field owns it and performs the insertion.
 *
 * **The offer survives typing that agrees with it.** An offer made at `from` stays on the table
 * while what was typed since is a prefix of it, and the ghost is what is left — no request at all.
 * That is LSP's `filterText` rule and the only way to Smart Compose's 60 ms budget: not asking.
 *
 * **Alternatives** are LSP's `Invoked` case: asking again at the same point appends a different
 * offer rather than replacing the one on the table, and `cycle` moves between them (Alt+] / Alt+[).
 */
export function useContinuation(options: {
  source: (request: ContinuationRequest) => AsyncIterable<string>;
  onEvent: (kind: AssistEvent["kind"], proposal: Proposal) => void;
  debounceMs?: number;
}) {
  const { run, cancel, status, error } = useStream<string>();
  const [ghost, setGhost] = useState("");
  const opts = useRef(options);
  opts.current = options;

  const offers = useRef<Offer[]>([]);
  const index = useRef(0);
  const field = useRef({ value: "", position: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shown = useRef<Offer | null>(null);

  const current = () => offers.current[index.current] ?? null;

  const rendered = useCallback((): string => {
    const o = current();
    if (!o) return "";
    const { value, position } = field.current;
    if (position < o.from) return "";
    const typed = value.slice(o.from, position);
    return o.text.startsWith(typed) ? o.text.slice(typed.length) : "";
  }, []);

  const alive = useCallback((): boolean => {
    const o = current();
    if (!o) return false;
    const { value, position } = field.current;
    if (position < o.from) return false;
    const typed = value.slice(o.from, position);
    // Typing ahead of a stream still arriving is not a mismatch yet: the next chunk may agree.
    return o.text.startsWith(typed) || (!o.done && typed.startsWith(o.text));
  }, []);

  const proposal = (o: Offer): Proposal => ({ text: o.text, range: [o.from, o.from] });

  const painter = useRef<ReturnType<typeof coalesce>>(undefined);
  painter.current ??= coalesce(() => {
    const next = rendered();
    setGhost(next);
    const o = current();
    if (next && o && shown.current !== o) {
      shown.current = o;
      opts.current.onEvent("shown", proposal(o));
    }
  });

  /** Forget every offer. `why` is reported once, for the offer on screen. */
  const drop = useCallback(
    (why?: "rejected" | "ignored") => {
      clearTimeout(timer.current);
      painter.current?.cancel();
      const o = current();
      if (why && o && shown.current === o) opts.current.onEvent(why, proposal(o));
      offers.current = [];
      index.current = 0;
      shown.current = null;
      cancel();
      setGhost("");
    },
    [cancel],
  );

  const start = useCallback(
    (value: string, position: number, trigger: Trigger) => {
      const avoid = offers.current.filter((o) => o.from === position).map((o) => o.text);
      const mine: Offer = { from: position, text: "", done: false };
      offers.current = [...offers.current.filter((o) => o.from === position), mine];
      index.current = offers.current.length - 1;
      const base = value.slice(0, position);
      let raw = "";
      void run(
        (signal) => opts.current.source({ value, position, trigger, avoid, signal }),
        (chunk) => {
          if (current() !== mine) return false;
          raw += chunk;
          mine.text = cleanGhost(base, raw);
          painter.current?.();
        },
      ).then((outcome) => {
        mine.done = true;
        if (current() !== mine) return;
        if (outcome === "ready") return painter.current?.flush();
        painter.current?.cancel();
        // A failed stream's half a continuation is not an offer; the failure is `error`.
        if (outcome === "error") {
          mine.text = "";
          setGhost("");
        }
      });
    },
    [run],
  );

  const short = (value: string) => value.trim().length < MIN_CONTINUE_LENGTH;

  /** The field changed. Ask after a debounce — unless the offer on the table survives it. */
  const setValue = useCallback(
    (value: string, position = value.length) => {
      field.current = { value, position };
      if (alive()) {
        setGhost(rendered());
        return;
      }
      drop("ignored");
      if (short(value)) return;
      timer.current = setTimeout(
        () => start(value, position, "automatic"),
        opts.current.debounceMs ?? 350,
      );
    },
    [alive, drop, rendered, start],
  );

  /** Ask now — the ✨, and Alt+] past the last alternative. */
  const ask = useCallback(
    (value: string, position = value.length) => {
      const same = field.current.value === value && field.current.position === position;
      field.current = { value, position };
      if (!same) drop("ignored");
      clearTimeout(timer.current);
      if (short(value)) return;
      start(value, position, "invoked");
    },
    [drop, start],
  );

  /** Move between alternatives; past the last one, ask for another. */
  const cycle = useCallback(
    (step: 1 | -1) => {
      const next = index.current + step;
      if (next < 0) return;
      if (next >= offers.current.length) {
        const { value, position } = field.current;
        ask(value, position);
        return;
      }
      index.current = next;
      setGhost(rendered());
      painter.current?.();
    },
    [ask, rendered],
  );

  const settle = useCallback(
    (kind: "accepted" | "partial", text: string) => {
      const o = current();
      if (o) opts.current.onEvent(kind, { text, range: [field.current.position, field.current.position] });
      if (kind === "accepted") {
        offers.current = [];
        index.current = 0;
        shown.current = null;
        clearTimeout(timer.current);
        painter.current?.cancel();
        cancel();
        setGhost("");
      }
    },
    [cancel],
  );

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      painter.current?.cancel();
    },
    [],
  );

  return { ghost, status, error, setValue, ask, cycle, settle, dismiss: drop };
}

// ── The candidates: N whole values, deduped ──────────────────────────────────

const norm = (v: string) => v.trim().toLowerCase();

/**
 * A streamed list of whole values, deduped against what the field already holds. A budget rather
 * than a window: nothing refills when one is taken or dismissed.
 */
export function useCandidates(options: {
  source: (request: { existing: string[]; signal: AbortSignal }) => AsyncIterable<Proposal>;
  existing: string[];
  onEvent: (kind: AssistEvent["kind"], proposal: Proposal) => void;
  limit?: number;
}) {
  const { run, cancel: abort, reset, status, error } = useStream<Proposal>();
  const [items, setItems] = useState<Proposal[]>([]);
  const shown = useRef<Proposal[]>([]);
  const opts = useRef(options);
  opts.current = options;

  const put = useCallback((next: Proposal[]) => {
    shown.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(() => {
    const { existing, limit = 6, source } = opts.current;
    const seen = new Set(existing.map(norm).filter(Boolean));
    const taken: Proposal[] = [];
    put([]);
    void run(
      (signal) => source({ existing, signal }),
      (item) => {
        const key = norm(item.text);
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
      const item = shown.current.find((p) => norm(p.text) === key);
      if (item) opts.current.onEvent(kind, item);
      const next = shown.current.filter((p) => norm(p.text) !== key);
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
