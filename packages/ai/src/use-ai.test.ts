import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Candidate } from "./types.js";
import {
  cleanGhost,
  type InlineCompletionRequest,
  useAiStream,
  useInlineCompletion,
  useSuggestions,
} from "./use-ai.js";

// ── Controllable fake async iterables ─────────────────────────────────────────

type Item<T> =
  | { ok: true; result: IteratorResult<T> }
  | { ok: false; error: unknown };

/** A hand-driven async iterable: `emit` / `complete` / `fail` on demand, and it records the
 *  `AbortSignal` it was opened with so a test can assert cancellation. */
function subject<T>() {
  const buffer: Item<T>[] = [];
  const waiting: Array<(item: Item<T>) => void> = [];
  let signal: AbortSignal | undefined;

  const settle = (item: Item<T>): Promise<IteratorResult<T>> =>
    item.ok ? Promise.resolve(item.result) : Promise.reject(item.error);
  const deliver = (item: Item<T>) => {
    const w = waiting.shift();
    if (w) w(item);
    else buffer.push(item);
  };

  return {
    source: (s?: AbortSignal): AsyncIterable<T> => {
      signal = s;
      return {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            const buffered = buffer.shift();
            if (buffered) return settle(buffered);
            return new Promise<IteratorResult<T>>((resolve, reject) => {
              waiting.push((item) => settle(item).then(resolve, reject));
            });
          },
        }),
      };
    },
    emit: (value: T) => deliver({ ok: true, result: { value, done: false } }),
    complete: () => deliver({ ok: true, result: { value: undefined as never, done: true } }),
    fail: (error: unknown) => deliver({ ok: false, error }),
    aborted: () => !!signal?.aborted,
  };
}

/** A finite async generator over `values`, honouring the signal — the shape a real product
 *  `suggest` / `complete` has. */
const genValues = (values: string[]) =>
  async function* (signal?: AbortSignal): AsyncGenerator<Candidate> {
    for (const value of values) {
      if (signal?.aborted) return;
      yield { value };
    }
  };

const genChunks = (chunks: string[]) =>
  async function* ({ signal }: InlineCompletionRequest): AsyncGenerator<string> {
    for (const c of chunks) {
      if (signal?.aborted) return;
      yield c;
    }
  };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const flush = async () => {
  await act(async () => {
    await tick();
    await tick();
  });
};

// ── cleanGhost — pure unit ────────────────────────────────────────────────────

describe("cleanGhost", () => {
  it("drops one leading full-value echo, case-insensitively", () => {
    expect(cleanGhost("Hello", "Hello world")).toBe(" world");
    expect(cleanGhost("hello", "HELLO world")).toBe(" world");
    expect(cleanGhost("Hello ", "Hello world")).toBe(" world"); // base is trimEnd-ed
  });
  it("holds back an echo that is still arriving", () => {
    // The bug this exists for, seen on the docs page: `cleanGhost` runs on the accumulated text
    // once a frame, so a half-arrived echo is a strict prefix of the value and rule one cannot
    // fire — the field painted its own sentence twice until the echo finished.
    const value = "Three hounds seen at the ford, in threes as they go";
    expect(cleanGhost(value, "Three hou")).toBe("");
    expect(cleanGhost(value, "Three hounds seen at the ford, in threes as they go")).toBe("");
    // And the frame it diverges on is the frame it appears.
    expect(cleanGhost(value, "Three hounds seen at the ford, in threes as they go and both")).toBe(
      " and both",
    );
  });

  it("leaves a non-matching continuation untouched", () => {
    expect(cleanGhost("abc", "xyz")).toBe("xyz");
    expect(cleanGhost("", "anything")).toBe("anything");
  });
});

// ── useAiStream — the engine ──────────────────────────────────────────────────

describe("useAiStream", () => {
  it("hands every value to `each` in order, and settles ready", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    const seen: number[] = [];
    let outcome: string | undefined;
    act(() => {
      void result.current
        .run(s.source, (v) => {
          seen.push(v);
        })
        .then((o) => {
          outcome = o;
        });
    });
    expect(result.current.status).toBe("loading");
    s.emit(1);
    s.emit(2);
    s.complete();
    await flush();
    expect(seen).toEqual([1, 2]);
    expect(outcome).toBe("ready");
    expect(result.current.status).toBe("ready");
  });

  it("stops where `each` says stop, and tells the source", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    const seen: number[] = [];
    act(() => {
      void result.current.run(s.source, (v) => {
        seen.push(v);
        return seen.length < 2;
      });
    });
    s.emit(1);
    s.emit(2);
    s.emit(3);
    await flush();
    expect(seen).toEqual([1, 2]);
    // The budget is enforced here rather than by the consumer walking away, so a source holding a
    // socket is told it can close it.
    expect(s.aborted()).toBe(true);
    expect(result.current.status).toBe("ready");
  });

  it("supersedes: the older run aborts, resolves idle, and writes nothing more", async () => {
    // The race the old `start`/`next` pair could not close on its own: `next()` read the CURRENT
    // iterator, so a stale loop could pull a chunk belonging to the run that replaced it and every
    // consumer had to re-check a captured signal. Here the controller is a local of the run.
    const a = subject<number>();
    const b = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    const seen: number[] = [];
    let first: string | undefined;
    act(() => {
      void result.current
        .run(a.source, (v) => {
          seen.push(v);
        })
        .then((o) => {
          first = o;
        });
    });
    act(() => {
      void result.current.run(b.source, (v) => {
        seen.push(v);
      });
    });
    expect(a.aborted()).toBe(true);
    a.emit(1);
    b.emit(2);
    await flush();
    expect(first).toBe("idle");
    expect(seen).toEqual([2]);
  });

  it("turns a throw into a status, an error and an outcome", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    let outcome: string | undefined;
    act(() => {
      void result.current.run(s.source, () => {}).then((o) => {
        outcome = o;
      });
    });
    s.fail(new Error("boom"));
    await flush();
    // The outcome is why there is no `peek()`: a loop that outlives its render used to read the
    // status field from a stale closure — the value from before the failure.
    expect(outcome).toBe("error");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("boom");
  });

  it("stays silent when the source throws after a cancel", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    let outcome: string | undefined;
    act(() => {
      void result.current.run(s.source, () => {}).then((o) => {
        outcome = o;
      });
    });
    act(() => result.current.cancel());
    s.fail(new Error("late"));
    await flush();
    expect(outcome).toBe("idle");
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("cancel clears the failure it is cancelling", async () => {
    // `abort()` used to leave `error` set and the status stuck on `error` — `idle()` explicitly
    // refused to leave it — so dismissing an offer after a failure kept reporting the failure.
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => {
      void result.current.run(s.source, () => {});
    });
    s.fail(new Error("boom"));
    await flush();
    expect(result.current.status).toBe("error");
    act(() => result.current.cancel());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("reset forgets a finished answer and leaves a live one alone", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => {
      void result.current.run(s.source, () => {});
    });
    act(() => result.current.reset());
    expect(result.current.status).toBe("loading");
    s.complete();
    await flush();
    expect(result.current.status).toBe("ready");
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
  });
});

// ── useSuggestions ────────────────────────────────────────────────────────────

describe("useSuggestions", () => {
  it("dedupes against existing (case-insensitive) and against each other", async () => {
    const suggest = genValues([
      "Public Health",
      "public health",
      "Epidemiology",
      "epidemiology",
      "Surveillance",
    ]);
    const { result } = renderHook(() =>
      useSuggestions({ suggest, existing: ["PUBLIC HEALTH"] }),
    );
    act(() => result.current.ask());
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual([
      "Epidemiology",
      "Surveillance",
    ]);
  });

  it("drops a candidate by VALUE, and nothing refills", async () => {
    // By value and not by index: the index-addressed version forced every caller to keep a
    // parallel lookup, and nothing refills because there is no window left to keep full.
    const suggest = genValues(["a", "b", "c", "d", "e"]);
    const { result } = renderHook(() => useSuggestions({ suggest, limit: 3 }));
    act(() => result.current.ask());
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual(["a", "b", "c"]);
    act(() => result.current.dismiss("b"));
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual(["a", "c"]);
  });

  it("takes no more than the limit, and defaults it", async () => {
    const suggest = genValues(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const { result } = renderHook(() => useSuggestions({ suggest }));
    act(() => result.current.ask());
    await flush();
    expect(result.current.items).toHaveLength(6);
  });

  it("walks idle → loading → ready, and says ready with nothing to offer", async () => {
    // `ready` with an empty list is the answer "the source had nothing", which a strip must be
    // able to say. The status/`loading` pair this replaced could not tell it from "never asked".
    const { result } = renderHook(() => useSuggestions({ suggest: genValues([]) }));
    expect(result.current.status).toBe("idle");
    act(() => result.current.ask());
    await flush();
    expect(result.current.status).toBe("ready");
    expect(result.current.items).toEqual([]);
  });

  it("reports a failing source as an error status, not a throw", async () => {
    const suggest = async function* () {
      yield { value: "a" };
      throw new Error("the source fell over");
    };
    const { result } = renderHook(() => useSuggestions({ suggest }));
    act(() => result.current.ask());
    await flush();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("the source fell over");
  });

  it("asks once, and `refresh` is how you ask again", async () => {
    let calls = 0;
    const suggest = (signal?: AbortSignal) => {
      calls += 1;
      return genValues(["a", "b", "c"])(signal);
    };
    const { result } = renderHook(() => useSuggestions({ suggest }));
    act(() => result.current.ask());
    await flush();
    expect(calls).toBe(1);
    act(() => result.current.ask()); // idempotent
    await flush();
    expect(calls).toBe(1);
    act(() => result.current.refresh());
    await flush();
    expect(calls).toBe(2);
    expect(result.current.items.map((i) => i.value)).toEqual(["a", "b", "c"]);
  });

  it("goes back to idle when the answer is spent, so the ✨ works again", async () => {
    // `ask` used to be gated on an `asked` ref that latched forever: take every candidate and the
    // mark became a button that did nothing. An answer with nothing left of it is not an answer.
    let calls = 0;
    const suggest = (signal?: AbortSignal) => {
      calls += 1;
      return genValues(["a", "b"])(signal);
    };
    const { result } = renderHook(() => useSuggestions({ suggest }));
    act(() => result.current.ask());
    await flush();
    expect(calls).toBe(1);
    act(() => result.current.dismiss("a"));
    expect(result.current.status).toBe("ready");
    act(() => result.current.dismiss("b"));
    expect(result.current.status).toBe("idle");
    act(() => result.current.ask());
    await flush();
    expect(calls).toBe(2);
  });

  it("cancel forgets, so the next ask goes back to the source", async () => {
    let calls = 0;
    const suggest = (signal?: AbortSignal) => {
      calls += 1;
      return genValues(["a"])(signal);
    };
    const { result } = renderHook(() => useSuggestions({ suggest }));
    act(() => result.current.ask());
    await flush();
    act(() => result.current.cancel());
    expect(result.current.status).toBe("idle");
    expect(result.current.items).toEqual([]);
    act(() => result.current.ask());
    await flush();
    expect(calls).toBe(2);
  });
});

// ── useInlineCompletion ───────────────────────────────────────────────────────

describe("useInlineCompletion", () => {
  it("accumulates chunks into the ghost", async () => {
    const { result } = renderHook(() =>
      useInlineCompletion({ complete: genChunks(["x", "y", "z"]) }),
    );
    act(() => result.current.ask("abcd"));
    await flush();
    expect(result.current.ghost).toBe("xyz");
    expect(result.current.ghost).not.toBe("");
  });

  it("cleans a restated full value off the ghost", async () => {
    const { result } = renderHook(() =>
      useInlineCompletion({ complete: genChunks(["Hello", " world"]) }),
    );
    act(() => result.current.ask("Hello"));
    await flush();
    expect(result.current.ghost).toBe(" world");
  });

  it("offers the ghost for the caller to insert, and dismiss forgets it", async () => {
    const { result } = renderHook(() =>
      useInlineCompletion({ complete: genChunks(["Hello", " world"]) }),
    );
    act(() => result.current.ask("Hello"));
    await flush();
    // The hook offers; the CALLER accepts. `accept()` used to return the ghost and then do exactly
    // what `dismiss()` does — a getter with a side effect whose return value the only consumer
    // never read, because it already holds `ghost`.
    expect(result.current.ghost).toBe(" world");
    act(() => result.current.dismiss());
    expect(result.current.ghost).toBe("");
  });

  it("dismiss() clears the ghost", async () => {
    const { result } = renderHook(() =>
      useInlineCompletion({ complete: genChunks(["x", "y"]) }),
    );
    act(() => result.current.ask("abcd"));
    await flush();
    expect(result.current.ghost).not.toBe("");
    act(() => result.current.dismiss());
    expect(result.current.ghost).toBe("");
  });

  it("aborts the prior stream when a new request starts", async () => {
    const subs: ReturnType<typeof subject<string>>[] = [];
    const complete = ({ signal }: InlineCompletionRequest) => {
      const s = subject<string>();
      subs.push(s);
      return s.source(signal);
    };
    const { result } = renderHook(() => useInlineCompletion({ complete }));
    act(() => result.current.ask("first text"));
    await flush();
    act(() => result.current.ask("second text"));
    expect(subs[0]?.aborted()).toBe(true);
  });

  it("keeps the offer while what you type agrees with it, and asks nothing", async () => {
    // The rule the whole thing turns on. It used to throw the offer away on every keystroke and
    // start a fresh 350 ms debounce, so the fastest a suggestion could come back was that plus a
    // model. LSP calls this `filterText`, Monaco calls it `inlineSuggest.mode: "prefix"`.
    let calls = 0;
    const complete = (request: InlineCompletionRequest) => {
      calls += 1;
      return genChunks([" world"])(request);
    };
    const { result } = renderHook(() => useInlineCompletion({ complete }));
    act(() => result.current.ask("Hello"));
    await flush();
    expect(result.current.ghost).toBe(" world");

    act(() => result.current.setValue("Hello w", 7));
    expect(result.current.ghost).toBe("orld");
    act(() => result.current.setValue("Hello world", 11));
    expect(result.current.ghost).toBe("");
    expect(calls).toBe(1);
  });

  it("drops the offer the moment what you type disagrees", async () => {
    const { result } = renderHook(() =>
      useInlineCompletion({ complete: genChunks([" world"]) }),
    );
    act(() => result.current.ask("Hello"));
    await flush();
    expect(result.current.ghost).toBe(" world");
    act(() => result.current.setValue("Hello!", 6));
    expect(result.current.ghost).toBe("");
  });

  it("offers at the caret, not at the end of the value", async () => {
    // What killed the old model: a continuation was an append, so the ghost vanished the moment the
    // caret was anywhere else. LSP's answer is a range; ours is its degenerate case, a position.
    let at = -1;
    const complete = (request: InlineCompletionRequest) => {
      at = request.position;
      return genChunks(["ADDED"])(request);
    };
    const { result } = renderHook(() => useInlineCompletion({ complete }));
    act(() => result.current.ask("one two", 3));
    await flush();
    expect(at).toBe(3);
    expect(result.current.ghost).toBe("ADDED");
  });

  it("tells the source whether a human asked or typing did", async () => {
    const seen: string[] = [];
    const complete = (request: InlineCompletionRequest) => {
      seen.push(request.trigger);
      return genChunks([])(request);
    };
    const { result } = renderHook(() => useInlineCompletion({ complete, debounceMs: 0 }));
    act(() => result.current.ask("abcd"));
    await flush();
    act(() => result.current.setValue("abcde"));
    await flush();
    expect(seen).toEqual(["invoked", "automatic"]);
  });

  it("says ready with an empty ghost when the model had nothing to add", async () => {
    // The half of the four-state union this hook was missing: `idle` + no ghost used to mean both
    // "never asked" and "asked, and there is nothing".
    const { result } = renderHook(() => useInlineCompletion({ complete: genChunks([]) }));
    expect(result.current.status).toBe("idle");
    act(() => result.current.ask("abcd"));
    await flush();
    expect(result.current.status).toBe("ready");
    expect(result.current.ghost).toBe("");
  });

  it("reports a failing source, and dismiss clears it", async () => {
    const complete = (): AsyncIterable<string> => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error("no model")),
      }),
    });
    const { result } = renderHook(() => useInlineCompletion({ complete }));
    act(() => result.current.ask("abcd"));
    await flush();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("no model");
    act(() => result.current.dismiss());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("debounces and enforces minLength", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const complete = (request: InlineCompletionRequest) => {
        calls += 1;
        return genChunks([])(request);
      };
      const { result } = renderHook(() =>
        useInlineCompletion({ complete, debounceMs: 350, minLength: 4 }),
      );
      act(() => result.current.setValue("abc")); // under minLength — never scheduled
      act(() => vi.advanceTimersByTime(400));
      expect(calls).toBe(0);

      act(() => result.current.setValue("abcd"));
      expect(calls).toBe(0); // still debouncing
      act(() => vi.advanceTimersByTime(350));
      expect(calls).toBe(1);
      // Drain the empty stream's microtasks (its idle() state update) inside act.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
