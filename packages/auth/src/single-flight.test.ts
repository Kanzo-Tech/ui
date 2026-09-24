import { describe, expect, it, vi } from "vitest";
import { keyedSingleFlight, singleFlight } from "./single-flight";

/** A promise you resolve by hand, so concurrency is asserted rather than slept on. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("singleFlight", () => {
  it("runs the work once for every caller that arrives while it is running", async () => {
    const gate = deferred<string>();
    const work = vi.fn(() => gate.promise);
    const call = singleFlight(work);

    // Ten requests noticing an expiring token in the same tick. With rotation, ten refreshes here
    // means nine replays of a spent token — which is the revocation this primitive prevents.
    const all = Promise.all(Array.from({ length: 10 }, () => call()));
    gate.resolve("token-2");

    expect(await all).toEqual(Array.from({ length: 10 }, () => "token-2"));
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("starts a new call once the previous one has settled", async () => {
    const work = vi.fn(async () => "token");
    const call = singleFlight(work);

    await call();
    await call();

    // Sequential calls are not deduplicated: the point is to collapse a burst, not to cache.
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("rejects every joined caller, and does not wedge the ones after", async () => {
    const failing = deferred<string>();
    const work = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => failing.promise)
      .mockImplementationOnce(async () => "recovered");
    const call = singleFlight(work);

    const first = call();
    const joined = call();
    failing.reject(new Error("network"));

    await expect(first).rejects.toThrow("network");
    await expect(joined).rejects.toThrow("network");

    // The failure was reported to whoever was waiting; it must not become permanent. A dropped
    // connection should not mean the session can never refresh again.
    await expect(call()).resolves.toBe("recovered");
    expect(work).toHaveBeenCalledTimes(2);
  });
});

describe("keyedSingleFlight", () => {
  it("collapses a burst per key, and keeps two keys apart", async () => {
    const ada = deferred<string>();
    const grace = deferred<string>();
    const call = keyedSingleFlight<string>();

    const adas = Promise.all(Array.from({ length: 5 }, () => call("ada", () => ada.promise)));
    const graces = Promise.all(Array.from({ length: 5 }, () => call("grace", () => grace.promise)));
    ada.resolve("ada's session");
    grace.resolve("grace's session");

    // One renewal each, and neither of them holding the other's cookie — which is the failure a
    // single unkeyed slot would produce on a server, and it would produce it silently.
    expect(await adas).toEqual(Array.from({ length: 5 }, () => "ada's session"));
    expect(await graces).toEqual(Array.from({ length: 5 }, () => "grace's session"));
  });

  it("runs the work once per burst, not once per caller", async () => {
    const gate = deferred<string>();
    const work = vi.fn(() => gate.promise);
    const call = keyedSingleFlight<string>();

    const all = Promise.all(Array.from({ length: 4 }, () => call("t-1", work)));
    gate.resolve("renewed");

    await all;
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("forgets a key once its call has settled, in both directions", async () => {
    const call = keyedSingleFlight<string>();
    const work = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(async () => {
        throw new Error("network");
      })
      .mockImplementationOnce(async () => "recovered");

    await expect(call("t-1", work)).rejects.toThrow("network");

    // A failed renewal must not wedge that one session onto a failure forever — the map holds what
    // is in flight, not a history of everyone who has ever signed in.
    await expect(call("t-1", work)).resolves.toBe("recovered");
  });
});
