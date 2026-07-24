import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  cleanGhost,
  useAiStream,
  useCompletion,
  useSuggestions,
  type Suggestion,
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
  async function* (signal?: AbortSignal): AsyncGenerator<Suggestion> {
    for (const value of values) {
      if (signal?.aborted) return;
      yield { value };
    }
  };

const genChunks = (chunks: string[]) =>
  async function* (_value: string, signal?: AbortSignal): AsyncGenerator<string> {
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
  it("leaves a non-matching continuation untouched", () => {
    expect(cleanGhost("abc", "xyz")).toBe("xyz");
    expect(cleanGhost("", "anything")).toBe("anything");
  });
});

// ── useAiStream — the engine ──────────────────────────────────────────────────

describe("useAiStream", () => {
  it("serializes concurrent next() into one ordered consumer", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => result.current.start(s.source));
    s.emit(1);
    s.emit(2);
    s.emit(3);
    let out: (number | null)[] = [];
    await act(async () => {
      out = await Promise.all([
        result.current.next(),
        result.current.next(),
        result.current.next(),
      ]);
    });
    expect(out).toEqual([1, 2, 3]);
  });

  it("aborts the prior stream on restart via start()", async () => {
    const a = subject<number>();
    const b = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => result.current.start(a.source));
    act(() => result.current.start(b.source));
    expect(a.aborted()).toBe(true);
    b.emit(7);
    let v: number | null = null;
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBe(7);
  });

  it("surfaces a thrown error", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => result.current.start(s.source));
    s.fail(new Error("boom"));
    let v: number | null = 1;
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBeNull();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("boom");
  });

  it("stays silent when the stream throws after an abort", async () => {
    const s = subject<number>();
    const { result } = renderHook(() => useAiStream<number>());
    act(() => result.current.start(s.source));
    let p: Promise<number | null> = Promise.resolve(null);
    await act(async () => {
      p = result.current.next();
      await Promise.resolve(); // let the pump call it.next() before we abort
    });
    act(() => result.current.abort());
    s.fail(new Error("late"));
    let v: number | null = 1;
    await act(async () => {
      v = await p;
    });
    expect(v).toBeNull();
    expect(result.current.status).not.toBe("error");
  });

  it("idle() keeps the iterator; abort() drops it", async () => {
    const { result } = renderHook(() => useAiStream<number>());

    const keep = subject<number>();
    act(() => result.current.start(keep.source));
    keep.emit(1);
    let v: number | null = null;
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBe(1);
    act(() => result.current.idle());
    expect(result.current.status).toBe("idle");
    keep.emit(2);
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBe(2); // resumed the same iterator

    const drop = subject<number>();
    act(() => result.current.start(drop.source));
    drop.emit(1);
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBe(1);
    act(() => result.current.abort());
    drop.emit(2);
    await act(async () => {
      v = await result.current.next();
    });
    expect(v).toBeNull(); // iterator was dropped
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
    act(() => result.current.start());
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual([
      "Epidemiology",
      "Surveillance",
    ]);
  });

  it("refills to the window when a row is dismissed", async () => {
    const suggest = genValues(["a", "b", "c", "d", "e"]);
    const { result } = renderHook(() => useSuggestions({ suggest, existing: [] }));
    act(() => result.current.start());
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual(["a", "b", "c"]);
    act(() => result.current.dismiss(0));
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual(["b", "c", "d"]);
  });

  it("retries the dry source exactly once (bounded)", async () => {
    let calls = 0;
    const suggest = (signal?: AbortSignal) => {
      calls += 1;
      return genValues(["x"])(signal);
    };
    const { result } = renderHook(() => useSuggestions({ suggest, existing: [] }));
    act(() => result.current.start());
    await flush();
    expect(result.current.items.map((i) => i.value)).toEqual(["x"]);
    expect(calls).toBe(2); // initial open + one retry, then it gives up
  });

  it("caches an open-cycle and refetches only after cancel", async () => {
    let calls = 0;
    const suggest = (signal?: AbortSignal) => {
      calls += 1;
      return genValues(["a", "b", "c"])(signal);
    };
    const { result } = renderHook(() => useSuggestions({ suggest, existing: [] }));
    act(() => result.current.start());
    await flush();
    expect(calls).toBe(1);
    act(() => result.current.start()); // idempotent within the cycle
    await flush();
    expect(calls).toBe(1);
    act(() => result.current.cancel());
    act(() => result.current.start());
    await flush();
    expect(calls).toBe(2);
    expect(result.current.items.map((i) => i.value)).toEqual(["a", "b", "c"]);
  });
});

// ── useCompletion ─────────────────────────────────────────────────────────────

describe("useCompletion", () => {
  it("accumulates chunks into the ghost", async () => {
    const { result } = renderHook(() =>
      useCompletion({ complete: genChunks(["x", "y", "z"]) }),
    );
    act(() => result.current.request("abcd"));
    await flush();
    expect(result.current.ghost).toBe("xyz");
    expect(result.current.hasGhost).toBe(true);
  });

  it("cleans a restated full value off the ghost", async () => {
    const { result } = renderHook(() =>
      useCompletion({ complete: genChunks(["Hello", " world"]) }),
    );
    act(() => result.current.request("Hello"));
    await flush();
    expect(result.current.ghost).toBe(" world");
  });

  it("accept() returns the ghost then clears it", async () => {
    const { result } = renderHook(() =>
      useCompletion({ complete: genChunks(["Hello", " world"]) }),
    );
    act(() => result.current.request("Hello"));
    await flush();
    let accepted = "";
    act(() => {
      accepted = result.current.accept();
    });
    expect(accepted).toBe(" world");
    expect(result.current.hasGhost).toBe(false);
  });

  it("dismiss() clears the ghost", async () => {
    const { result } = renderHook(() =>
      useCompletion({ complete: genChunks(["x", "y"]) }),
    );
    act(() => result.current.request("abcd"));
    await flush();
    expect(result.current.hasGhost).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.hasGhost).toBe(false);
  });

  it("aborts the prior stream when a new request starts", async () => {
    const subs: ReturnType<typeof subject<string>>[] = [];
    const complete = (_value: string, signal?: AbortSignal) => {
      const s = subject<string>();
      subs.push(s);
      return s.source(signal);
    };
    const { result } = renderHook(() => useCompletion({ complete }));
    act(() => result.current.request("first text"));
    await flush();
    act(() => result.current.request("second text"));
    expect(subs[0]?.aborted()).toBe(true);
  });

  it("debounces and enforces minLength", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const complete = (value: string, signal?: AbortSignal) => {
        calls += 1;
        return genChunks([])(value, signal);
      };
      const { result } = renderHook(() =>
        useCompletion({ complete, debounceMs: 350, minLength: 4 }),
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
