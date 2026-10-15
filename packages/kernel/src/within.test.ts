import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Problem, within, until } from "./index.js";

const silent = (after: number) => new Problem("api/silent", `no answer within ${after} ms`, { after });
const never = (signal: AbortSignal) => new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("within", () => {
  it("answers, and clears its timer", async () => {
    await expect(within(100, async () => 7, { silent })).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with silent(ms) when the deadline wins, and aborts the signal it handed out", async () => {
    let seen!: AbortSignal;
    const result = within(100, (signal) => ((seen = signal), new Promise<never>(() => {})), { silent });
    const settled = expect(result).rejects.toMatchObject({ code: "api/silent", data: { after: 100 } });
    await vi.advanceTimersByTimeAsync(100);
    await settled;
    expect(seen.aborted).toBe(true);
    expect(seen.reason).toBeInstanceOf(Problem);
  });

  it("rejects with the caller's reason when the caller aborts, and reaches wait's signal", async () => {
    const caller = new AbortController();
    let seen!: AbortSignal;
    const result = within(100, (signal) => ((seen = signal), never(signal)), { signal: caller.signal, silent });
    const settled = expect(result).rejects.toMatchObject({ name: "AbortError" });
    caller.abort(new DOMException("stop", "AbortError"));
    await settled;
    expect(seen.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not call wait when the caller is already aborted", async () => {
    const wait = vi.fn(async () => 1);
    await expect(within(100, wait, { signal: AbortSignal.abort(new DOMException("stop", "AbortError")), silent })).rejects.toMatchObject({ name: "AbortError" });
    expect(wait).not.toHaveBeenCalled();
  });

  it("nests: an inner deadline shorter than the outer names itself, and an outer Stop reaches the inner wait", async () => {
    const inner = (signal: AbortSignal) => within(50, never, { signal, silent: (a) => new Problem("idp/silent", "x", { after: a }) });
    const first = within(100, inner, { silent });
    const innerSettled = expect(first).rejects.toMatchObject({ code: "idp/silent" });
    await vi.advanceTimersByTimeAsync(50);
    await innerSettled;

    const outer = new AbortController();
    const second = within(100, inner, { signal: outer.signal, silent });
    const stopped = expect(second).rejects.toMatchObject({ name: "AbortError" });
    outer.abort(new DOMException("stop", "AbortError"));
    await stopped;
  });

  it("propagates wait's own rejection untouched", async () => {
    const failure = new Problem("engine/failed", "refused");
    await expect(within(100, () => Promise.reject(failure), { silent })).rejects.toBe(failure);
  });
});

describe("until", () => {
  it("is the promise itself without a signal", async () => {
    const answer = Promise.resolve(1);
    expect(until(answer)).toBe(answer);
  });

  it("rejects with the reason the moment the signal aborts, and ignores the late answer", async () => {
    const controller = new AbortController();
    let late!: (value: number) => void;
    const result = until(new Promise<number>((resolve) => (late = resolve)), controller.signal);
    const settled = expect(result).rejects.toBe("because");
    controller.abort("because");
    await settled;
    late(1);
  });

  it("swallows a late rejection of an abandoned answer, already aborted or not", async () => {
    const aborted = AbortSignal.abort("x");
    await expect(until(Promise.reject(new Error("late")), aborted)).rejects.toBe("x");
    const controller = new AbortController();
    const result = until(new Promise((_, reject) => setTimeout(() => reject(new Error("late")), 10)), controller.signal);
    const settled = expect(result).rejects.toBe("y");
    controller.abort("y");
    await settled;
    await vi.advanceTimersByTimeAsync(10);
  });

  it("answers if the answer comes first", async () => {
    await expect(until(Promise.resolve(3), new AbortController().signal)).resolves.toBe(3);
  });
});
