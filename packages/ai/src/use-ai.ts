"use client";

// Headless AI-assist engine — the streaming machinery behind inline ghost completion (`Complete`,
// via `useInlineCompletion`) and a candidate strip (`Suggest`, via `useSuggestions`). Domain-free
// and source-agnostic: a consumer passes a function returning an async iterable and cancels it
// with an `AbortSignal`. It imports nothing of `@codemirror/*` — `CodeEditor` has no completion
// prop and never had one, and this package must not grow one, because `ui/editor` importing from
// here would make `ui` depend on `ai` and `ai` already depends on `ui`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candidate } from "./types.js";

/**
 * The continuation is meant to be appended verbatim. Two safety nets, and no character-level
 * surgery — that mangled coincidental overlaps and was removed.
 *
 * 1. **The finished echo.** A model that restated the whole value before continuing gets that one
 *    unambiguous prefix dropped.
 * 2. **The echo still arriving**, which is the one you can see. `cleanGhost` runs on the
 *    *accumulated* text once a frame, so while an echo is streaming in, `cont` is a strict prefix
 *    of the value and rule 1 cannot fire yet — the field painted the sentence it already contained,
 *    a second time, until the echo completed. Measured live on the Complete page: a value of
 *    `Three hounds seen at the ford, in threes as they go` with a ghost reading `Three hou`.
 *
 *    So an unresolved echo renders as nothing. What it costs is a genuine continuation that happens
 *    to begin with the value's own opening characters — hidden for the few frames until it diverges,
 *    which is invisible next to painting the value twice.
 */
export function cleanGhost(base: string, cont: string): string {
  const b = base.trimEnd();
  if (!b || !cont) return cont;
  const lower = { base: b.toLowerCase(), cont: cont.toLowerCase() };
  if (lower.cont.startsWith(lower.base)) return cont.slice(b.length);
  if (lower.base.startsWith(lower.cont)) return "";
  return cont;
}

const message = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

/**
 * Where a request has got to. **One union for the engine and both hooks**, because a status plus a
 * boolean is two spellings of one fact and they drift: this file carried three vocabularies at
 * once, and the pair `status` + `loading` could not tell *never asked* from *asked, here they are*.
 *
 * `ready` means a run finished — with something or with nothing. An empty `ready` is the honest
 * answer "the source had nothing", which a surface should say rather than sit blank.
 */
export type AiStatus = "idle" | "loading" | "ready" | "error";

export interface AiStream<T> {
  /**
   * Open `source` and pull it to the end, handing every value to `each`. Return `false` from `each`
   * to stop early — a budget, a match, whatever the consumer's rule is.
   *
   * **The engine owns the loop**, and that is the point of this shape. When it was `start` +
   * `next` + `idle` every consumer wrote the same twenty lines and the same abort-race protocol —
   * capture the signal, pull, check it twice — four times over, because `next()` read the *current*
   * iterator and a superseded loop could otherwise steal a chunk from the run that replaced it.
   * Here the controller is a local of this closure, so a superseded run cannot see the new one.
   *
   * Supersedes anything in flight. Resolves to what happened to **this** run: `ready`, `error`, or
   * `idle` if it was cancelled or superseded. That return is why there is no `peek()`: a loop that
   * outlives the render that started it used to read `error` from a stale closure — the value from
   * before the failure — so it needed a second way in.
   */
  run: (
    source: (signal: AbortSignal) => AsyncIterable<T>,
    each: (value: T) => boolean | void,
  ) => Promise<AiStatus>;
  /** Abort anything in flight and go back to idle, clearing any error. */
  cancel: () => void;
  /** Forget a finished answer. A live stream is untouched — there is nothing to forget yet. */
  reset: () => void;
  status: AiStatus;
  error: string | null;
}

/** The shared engine: one iterator, one controller, one status. */
export function useAiStream<T>(errorText = "Something went wrong"): AiStream<T> {
  const [status, setStatus] = useState<AiStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Beside the state, and read only where a decision is synchronous (`reset`). Anything a surface
  // renders has to be state: this was a ref first, and the strip stayed on whatever status it
  // happened to paint with.
  const statusRef = useRef<AiStatus>("idle");
  const ctrl = useRef<AbortController>(undefined);
  const errRef = useRef(errorText);
  errRef.current = errorText;

  const set = useCallback((s: AiStatus, e: string | null = null) => {
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

      return (async (): Promise<AiStatus> => {
        let it: AsyncIterator<T>;
        try {
          it = src(c.signal)[Symbol.asyncIterator]();
        } catch (e) {
          set("error", message(e, errRef.current));
          return "error";
        }
        for (;;) {
          let res: IteratorResult<T>;
          try {
            res = await it.next();
          } catch (e) {
            // A throw on the way out is not a failure to report — the caller asked for it.
            if (c.signal.aborted) return "idle";
            set("error", message(e, errRef.current));
            return "error";
          }
          if (c.signal.aborted) return "idle";
          if (res.done) break;
          if (each(res.value) === false) {
            // Enough. The source is told, because it is the one holding the socket.
            c.abort();
            break;
          }
        }
        set("ready");
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

  return useMemo(
    () => ({ run, cancel, reset, status, error }),
    [cancel, error, reset, run, status],
  );
}

// ── frame coalescing ─────────────────────────────────────────────────────────

interface Coalesced {
  (): void;
  flush: () => void;
  cancel: () => void;
}

/**
 * Run `paint` at most once a frame, and once more on `flush()` so the last chunk is never the one
 * that got dropped. `requestAnimationFrame` rather than a millisecond interval because the thing
 * being matched is the display, and because a hidden tab stops firing it — which is the correct
 * behaviour for a paint nobody is looking at.
 *
 * It throttles a **call**, not a value. Carrying the pending value meant a superseded run could
 * flush a string the newer one had already replaced; a repaint that derives what to show from the
 * current offer cannot be stale, so there is nothing to guard.
 */
function coalesce(paint: () => void): Coalesced {
  let frame: number | undefined;
  let queued = false;

  const run: Coalesced = () => {
    queued = true;
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      queued = false;
      paint();
    });
  };

  run.flush = () => {
    const pending = queued;
    run.cancel();
    if (pending) paint();
  };

  run.cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    queued = false;
  };

  return run;
}

// ── useInlineCompletion — inline continuation (bring your own input) ─────────

/** Below this there is not enough text to continue, so no request is made. `Complete` reads it to
 *  keep its ✨ from being a button that does nothing. */
export const MIN_COMPLETE_LENGTH = 4;

/**
 * Why a request is being made. LSP 3.18's `InlineCompletionTriggerKind` minus the `Kind`, and it
 * exists for the reason the spec has it: a source may reasonably answer an explicit ask with
 * something longer and dearer than it answers a keystroke.
 */
export type InlineCompletionTrigger = "invoked" | "automatic";

/**
 * What the source is asked.
 *
 * **`position`, not just `value`.** A completion is offered *at the caret* — it was an append at
 * the end of the value, which is why the ghost used to vanish the moment the caret was not there.
 * LSP calls this a `range` and prefers a replacement over an insertion; ours is the degenerate
 * range, an insertion point, because our fields hold prose and not code.
 */
export interface InlineCompletionRequest {
  /** The whole field value. A source that only wants what comes before the caret slices it. */
  value: string;
  /** Where the continuation goes. */
  position: number;
  trigger: InlineCompletionTrigger;
  signal?: AbortSignal;
}

export interface UseInlineCompletionOptions {
  /** Streaming inline completion — yields continuation chunks; honour the `AbortSignal`. */
  complete: (request: InlineCompletionRequest) => AsyncIterable<string>;
  debounceMs?: number;
  minLength?: number;
}

export interface InlineCompletion {
  /**
   * What is left to insert **at the caret**, empty when there is nothing.
   *
   * There is no `hasGhost`, for the reason `useSuggestions` returns `items` and no `hasItems`: a
   * derived boolean beside the thing it is derived from is a second spelling of one fact.
   */
  ghost: string;
  /** `ready` with an empty `ghost` is "asked, and the model had nothing to add". */
  status: AiStatus;
  error: string | null;
  /**
   * The field changed. Ask after a debounce — **unless the offer already on the table survives**,
   * which is the whole reason this takes a caret.
   */
  setValue: (value: string, position?: number) => void;
  /** Ask now, as `"invoked"` — the ✨ path. */
  ask: (value: string, position?: number) => void;
  /**
   * Forget the offer, and stop anything in flight.
   *
   * **There is no `accept` and no `clear`.** `clear` was a second name bound to this same function.
   * And `accept` returned the ghost for the caller to insert and then did exactly this — but the
   * caller already holds `ghost` and already owns the value, so the return was unread by the only
   * consumer there has ever been. **The hook offers; the caller accepts.**
   */
  dismiss: () => void;
}

/** An offer on the table: a continuation, and the point in the value it was made at. */
interface Offer {
  from: number;
  /** Everything received so far, with the echo rule already applied. */
  text: string;
  /** The stream ended, so a `typed` longer than `text` is a mismatch rather than a wait. */
  done: boolean;
}

/**
 * Ghost-text completion that does NOT own the input value — the caller's field owns the text and
 * performs the insertion; this only offers a continuation and forgets it on `dismiss`.
 *
 * ## The offer survives typing that agrees with it
 *
 * This is the difference a reader feels, and it is one rule: an offer made at `from` stays on the
 * table while what has been typed since is a prefix of it, and the ghost is simply what is left.
 * Type the word the model was going to write and the ghost shortens; **no request is made at all.**
 *
 * It threw the whole offer away on every keystroke and started a fresh debounce, so the fastest a
 * suggestion could reappear was 350 ms plus a model. Smart Compose's budget is 60 ms at p90, and
 * you cannot get there by asking again — you get there by not asking. LSP 3.18 spells the same rule
 * `filterText` ("an inline completion is shown if the text to replace is a prefix of the filter
 * text") and Monaco spells it `inlineSuggest.mode: "prefix"`.
 */
export function useInlineCompletion(options: UseInlineCompletionOptions): InlineCompletion {
  const { run, cancel, status, error } = useAiStream<string>("Couldn’t complete");
  const [ghost, setGhost] = useState("");

  const opts = useRef(options);
  opts.current = options;

  const offer = useRef<Offer | null>(null);
  /** The field as of the last thing the caller told us. `rendered` is a function of this. */
  const field = useRef({ value: "", position: 0 });
  const askTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** What is on offer at the caret right now — "" when nothing is, which is not the same as dead. */
  const rendered = useCallback((): string => {
    const o = offer.current;
    if (!o) return "";
    const { value, position } = field.current;
    if (position < o.from) return "";
    const typed = value.slice(o.from, position);
    return o.text.startsWith(typed) ? o.text.slice(typed.length) : "";
  }, []);

  /** Is the offer still about the text in the field? */
  const alive = useCallback((): boolean => {
    const o = offer.current;
    if (!o) return false;
    const { value, position } = field.current;
    if (position < o.from) return false;
    const typed = value.slice(o.from, position);
    // A `typed` longer than what has arrived is only a mismatch once the stream has ended: mid-flight
    // it is the reader typing ahead of the model, and the next chunk may well agree with them.
    return o.text.startsWith(typed) || (!o.done && typed.startsWith(o.text));
  }, []);

  const painter = useRef<Coalesced>(undefined);
  painter.current ??= coalesce(() => setGhost(rendered()));

  const drop = useCallback(() => {
    clearTimeout(askTimer.current);
    painter.current?.cancel();
    offer.current = null;
    cancel();
    setGhost("");
  }, [cancel]);

  // The write is coalesced to a frame rather than done per chunk: a token stream arrives faster than
  // the display refreshes, so a `setState` per chunk renders work nobody sees. keasy's Ask panel hit
  // this and grew its own `rafPending` guard around the same loop.
  const start = useCallback(
    (value: string, position: number, trigger: InlineCompletionTrigger) => {
      const mine: Offer = { from: position, text: "", done: false };
      offer.current = mine;
      const base = value.slice(0, position);
      let raw = "";
      void run(
        (signal) => opts.current.complete({ value, position, trigger, signal }),
        (chunk) => {
          // Superseded or dismissed: stop pulling rather than write into somebody else's offer.
          if (offer.current !== mine) return false;
          raw += chunk;
          mine.text = cleanGhost(base, raw);
          painter.current?.();
        },
      ).then((outcome) => {
        if (offer.current !== mine) return;
        mine.done = true;
        if (outcome === "ready") painter.current?.flush();
        else painter.current?.cancel();
      });
    },
    [run],
  );

  const short = (value: string) =>
    value.trim().length < (opts.current.minLength ?? MIN_COMPLETE_LENGTH);

  const setValue = useCallback(
    (value: string, position = value.length) => {
      field.current = { value, position };
      if (alive()) {
        // The offer covers this keystroke. Repaint and ask nothing — this is the whole feature.
        setGhost(rendered());
        return;
      }
      drop();
      if (short(value)) return;
      askTimer.current = setTimeout(
        () => start(value, position, "automatic"),
        opts.current.debounceMs ?? 350,
      );
    },
    [alive, drop, rendered, start],
  );

  const ask = useCallback(
    (value: string, position = value.length) => {
      field.current = { value, position };
      drop();
      if (short(value)) return;
      start(value, position, "invoked");
    },
    [drop, start],
  );

  useEffect(
    () => () => {
      clearTimeout(askTimer.current);
      painter.current?.cancel();
    },
    [],
  );

  return useMemo(
    () => ({ ghost, status, error, setValue, ask, dismiss: drop }),
    [ask, drop, error, ghost, setValue, status],
  );
}

// ── useSuggestions — a deduped candidate strip ───────────────────────────────

/** Case-insensitive key for deduping suggestion values. */
const norm = (v: string) => v.trim().toLowerCase();

export interface UseSuggestionsOptions {
  suggest: (signal?: AbortSignal) => AsyncIterable<Candidate>;
  /** Current values — a candidate equal to one of these (case-insensitively) never appears. */
  existing?: string[];
  /**
   * How many to take from the stream. A strip wraps, so this is a budget rather than a window:
   * nothing refills when one is dismissed.
   *
   * @default 6
   */
  limit?: number;
}

export interface SuggestionsController {
  items: Candidate[];
  /** `ready` with no items means the source had nothing — not that its answer was consumed. */
  status: AiStatus;
  error: string | null;
  /** Ask the source. A no-op unless idle: in flight, already answered, or failed, it does nothing
   *  and `refresh` is the way through. */
  ask: () => void;
  /** Ask again from scratch, discarding what is shown. Also the retry after an error. */
  refresh: () => void;
  /** Abort in flight, and forget. */
  cancel: () => void;
  /**
   * Drop one candidate, **by value**.
   *
   * By value and not by index: an index-addressed list forces every caller to keep a parallel
   * lookup, and it is wrong the moment anything else mutates the array.
   */
  dismiss: (value: string) => void;
}

/**
 * A streamed list of candidate values, deduped against what the field already holds.
 *
 * The engine is shared with `useInlineCompletion`; what is here is the part specific to a list:
 * dedup, a budget, and the rule for when asking again is free. **No windowing and no refill loop**
 * — those existed to keep exactly three rows alive inside a popover, and the popover is gone.
 */
export function useSuggestions(options: UseSuggestionsOptions): SuggestionsController {
  const { run, cancel: abort, reset, status, error } = useAiStream<Candidate>(
    "Couldn’t load suggestions",
  );
  const [items, setItems] = useState<Candidate[]>([]);
  // A ref beside the state so `dismiss` can filter what is on screen *now* without taking `items`
  // as a dependency — which would hand every consumer a new callback on every render.
  const shown = useRef<Candidate[]>([]);

  const opts = useRef(options);
  opts.current = options;

  const put = useCallback((next: Candidate[]) => {
    shown.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(() => {
    const { existing = [], limit = 6, suggest } = opts.current;
    const seen = new Set(existing.map(norm).filter(Boolean));
    const taken: Candidate[] = [];
    put([]);
    void run(
      (signal) => suggest(signal),
      (item) => {
        const key = norm(item.value);
        if (!key || seen.has(key)) return true;
        seen.add(key);
        taken.push(item);
        put([...taken]);
        return taken.length < limit;
      },
    );
  }, [put, run]);

  // Gated on the status alone, and that one line replaced an `asked` ref that latched forever:
  // take every candidate and the ✨ became a button that did nothing, because "has been asked" is
  // not the question. The question is whether anything is in flight or on screen, and the status
  // answers it — `dismiss` puts it back to idle when nothing is left of the answer.
  const ask = useCallback(() => {
    if (status !== "idle") return;
    refresh();
  }, [refresh, status]);

  const cancel = useCallback(() => {
    abort();
    put([]);
  }, [abort, put]);

  const dismiss = useCallback(
    (value: string) => {
      const key = norm(value);
      const next = shown.current.filter((item) => norm(item.value) !== key);
      put(next);
      // Nothing left of an answer is not the same as an answer with nothing in it. This is what
      // keeps a strip from saying "Nothing to suggest." at the reader who just took the last one.
      if (next.length === 0) reset();
    },
    [put, reset],
  );

  return useMemo(
    () => ({ items, status, error, ask, refresh, cancel, dismiss }),
    [ask, cancel, dismiss, error, items, refresh, status],
  );
}
