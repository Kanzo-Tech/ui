// The rules of a continuation's offers, with nothing to run them: no React, no timers, no DOM. Every
// operation is synchronous and returns what the host is told; `useContinuation` adds the stream, the
// debounce and the painting.

import type { AssistEvent } from "./engine.js";
import type { Proposal } from "./task/index.js";

/** Below four characters there is not enough text to continue, so nothing is asked. */
export const askable = (value: string) => value.trim().length >= 4;

/** A continuation offered at `at`, as the Task's proposal of the text it inserts there. */
export const continuationAt = (value: string, at: number): Proposal<string> => ({
  id: `continuation-${at}`,
  task: "continuation",
  value,
  target: { insert: at },
  verdict: { ok: true },
  attempts: 1,
});

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

/** Leading space plus the next word — what one press of the accept-a-word key takes. */
export const nextWord = (ghost: string) => /^\s*\S+/.exec(ghost)?.[0] ?? "";

export interface Offer {
  readonly from: number;
  /** The value before `from` when it was asked, which `cleanGhost` strips an echo of. */
  readonly base: string;
  raw: string;
  text: string;
  done: boolean;
}

export interface OfferEvent {
  kind: AssistEvent["kind"];
  proposal: Proposal<string>;
}

export type Offers = ReturnType<typeof offers>;

/**
 * The offers made at the caret, and which one is on the table. Each operation returns what the host
 * is told, as events to send in order.
 */
export function offers() {
  let value = "";
  let caret = 0;
  let list: Offer[] = [];
  let index = 0;
  /** The offer last reported `shown`, so it is reported once. */
  let shown: Offer | null = null;

  const current = (): Offer | undefined => list[index];
  const told = (kind: OfferEvent["kind"], text: string, at: number): OfferEvent[] => [
    { kind, proposal: continuationAt(text, at) },
  ];

  /** What was typed since the offer on the table was made, or `null` when the caret is before it. */
  const typed = (o: Offer) => (caret < o.from ? null : value.slice(o.from, caret));

  /** What is left of the offer on the table once what was typed since is taken off it. */
  const ghost = () => {
    const o = current();
    const t = o && typed(o);
    return o && t != null && o.text.startsWith(t) ? o.text.slice(t.length) : "";
  };

  /** Typing ahead of a stream still arriving is not a mismatch yet: the next chunk may agree. */
  const alive = () => {
    const o = current();
    const t = o && typed(o);
    return !!o && t != null && (o.text.startsWith(t) || (!o.done && t.startsWith(o.text)));
  };

  /** Forget every offer. `why` is reported once, for the offer on screen. */
  const drop = (why?: "rejected" | "ignored"): OfferEvent[] => {
    const o = current();
    const events = why && o && shown === o ? told(why, o.text, o.from) : [];
    list = [];
    index = 0;
    shown = null;
    return events;
  };

  return {
    ghost,
    drop,
    get value() {
      return value;
    },
    get caret() {
      return caret;
    },

    /**
     * The reader typed. An offer survives typing that agrees with it — LSP's `filterText`, and the
     * only way to Smart Compose's 60 ms budget: not asking — so `null`; otherwise it is ignored.
     */
    type(next: string, at: number): OfferEvent[] | null {
      value = next;
      caret = at;
      return alive() ? null : drop("ignored");
    },

    /** The reader asked at a point; the offers made anywhere else are ignored. */
    invoke(next: string, at: number): OfferEvent[] | null {
      const same = value === next && caret === at;
      value = next;
      caret = at;
      return same ? null : drop("ignored");
    },

    /** A new offer at the caret, beside the ones made there, which it must differ from — LSP's `Invoked` case. */
    open() {
      const here = list.filter((o) => o.from === caret);
      const offer: Offer = { from: caret, base: value.slice(0, caret), raw: "", text: "", done: false };
      list = [...here, offer];
      index = list.length - 1;
      return { offer, avoid: here.map((o) => o.text) };
    },

    /** A chunk of `offer`. `false` when it is no longer the one on the table: its stream should stop. */
    arrive(offer: Offer, chunk: string): boolean {
      if (current() !== offer) return false;
      offer.raw += chunk;
      offer.text = cleanGhost(offer.base, offer.raw);
      return true;
    },

    /**
     * `offer`'s stream ended; `true` when it is the one on the table. A failed stream's half a
     * continuation there is not an offer.
     */
    end(offer: Offer, failed: boolean): boolean {
      offer.done = true;
      if (current() !== offer) return false;
      if (failed) offer.text = "";
      return true;
    },

    /** The ghost was painted: an offer is `shown` the first time any of it is on screen. */
    show(): OfferEvent[] {
      const o = current();
      if (!o || !ghost() || shown === o) return [];
      shown = o;
      return told("shown", o.text, o.from);
    },

    /** Move between alternatives: `true` when it moved, `"more"` past the last, `false` before the first. */
    turn(step: 1 | -1): boolean | "more" {
      const next = index + step;
      if (next < 0) return false;
      if (next >= list.length) return "more";
      index = next;
      return true;
    },

    /** The reader took `text` at the caret: the whole offer, which ends it, or a word, which does not. */
    take(kind: "accepted" | "partial", text: string): OfferEvent[] {
      const events = current() ? told(kind, text, caret) : [];
      if (kind === "accepted") drop();
      return events;
    },
  };
}
