import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installNavigation, unload } from "./fake-navigation.fixture";
import { blockers } from "./registry";
import type { UseBlockerOpts } from "./types";
import { useBlocker } from "./use-blocker";

let nav: ReturnType<typeof installNavigation>;

beforeEach(() => {
  nav = installNavigation();
});

afterEach(() => {
  cleanup();
  nav.uninstall();
  vi.restoreAllMocks();
});

const flush = () => act(async () => {});

describe("useBlocker on the platform half", () => {
  it("listens only while a blocker is registered", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { rerender, unmount } = renderHook((opts: UseBlockerOpts) => useBlocker(opts), {
      initialProps: { shouldBlockFn: () => true, disabled: true },
    });
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.anything());
    expect(unload()).toBe(false);

    rerender({ shouldBlockFn: () => true, disabled: false });
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(unload()).toBe(true);

    unmount();
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(blockers).toHaveLength(0);
    expect(unload()).toBe(false);
  });

  it("asks beforeunload by enableBeforeUnload, never by shouldBlockFn", () => {
    const shouldBlockFn = vi.fn(() => true);
    const { rerender } = renderHook((opts: UseBlockerOpts) => useBlocker(opts), {
      initialProps: { shouldBlockFn, enableBeforeUnload: false } as UseBlockerOpts,
    });
    expect(unload()).toBe(false);
    rerender({ shouldBlockFn, enableBeforeUnload: () => true });
    expect(unload()).toBe(true);
    expect(shouldBlockFn).not.toHaveBeenCalled();
  });

  it("cancels a back traversal and says what it was", () => {
    const shouldBlockFn = vi.fn(() => true);
    renderHook(() => useBlocker({ shouldBlockFn }));
    expect(nav.back()).toBe(false);
    expect(shouldBlockFn).toHaveBeenCalledWith({
      current: expect.objectContaining({ href: location.href }),
      next: expect.objectContaining({ pathname: "/a" }),
      action: "BACK",
    });
  });

  it("names FORWARD and GO by the distance travelled", () => {
    const actions: string[] = [];
    renderHook(() =>
      useBlocker({
        shouldBlockFn: ({ action }) => {
          actions.push(action);
          return true;
        },
      }),
    );
    nav.forward();
    nav.go(2);
    expect(actions).toEqual(["FORWARD", "GO"]);
  });

  it("lets a navigation through untouched when shouldBlockFn answers false synchronously", () => {
    renderHook(() => useBlocker({ shouldBlockFn: () => false }));
    expect(nav.back()).toBe(true);
    expect(nav.navigation.traverseTo).not.toHaveBeenCalled();
  });

  it("holds a blocked navigation until proceed, then replays it once", async () => {
    const shouldBlockFn = vi.fn(() => true);
    const { result } = renderHook(() => useBlocker({ shouldBlockFn, withResolver: true }));
    expect(result.current.status).toBe("idle");
    expect(result.current.proceed).toBeUndefined();

    act(() => void nav.back());
    await flush();
    expect(result.current).toMatchObject({
      status: "blocked",
      action: "BACK",
      next: { pathname: "/a" },
    });
    expect(nav.committed).toEqual([]);

    act(() => result.current.proceed?.());
    await flush();
    expect(result.current.status).toBe("idle");
    expect(nav.navigation.traverseTo).toHaveBeenCalledWith("k0");
    expect(nav.committed).toEqual(["traverse http://localhost/a"]);
    // The replay went past the blocker: it was asked about the navigation once, not twice.
    expect(shouldBlockFn).toHaveBeenCalledTimes(1);
  });

  it("stays on reset, and replays nothing", async () => {
    const { result } = renderHook(() => useBlocker({ shouldBlockFn: () => true, withResolver: true }));
    act(() => void nav.back());
    await flush();
    act(() => result.current.reset?.());
    await flush();
    expect(result.current.status).toBe("idle");
    expect(nav.navigation.traverseTo).not.toHaveBeenCalled();
    expect(nav.committed).toEqual([]);
  });

  it("keeps only the latest navigation when a second arrives while the first is asked about", async () => {
    const { result } = renderHook(() => useBlocker({ shouldBlockFn: () => true, withResolver: true }));
    act(() => void nav.back());
    await flush();
    act(() => void nav.forward());
    await flush();
    expect(result.current).toMatchObject({ status: "blocked", action: "FORWARD" });
    act(() => result.current.proceed?.());
    await flush();
    expect(nav.navigation.traverseTo).toHaveBeenCalledTimes(1);
    expect(nav.navigation.traverseTo).toHaveBeenCalledWith("k2");
  });

  it("blocks nothing while disabled", () => {
    renderHook(() => useBlocker({ shouldBlockFn: () => true, disabled: true }));
    expect(nav.back()).toBe(true);
    expect(unload()).toBe(false);
  });

  it("cancels now and replays later when shouldBlockFn answers with a promise", async () => {
    renderHook(() => useBlocker({ shouldBlockFn: async () => false }));
    expect(nav.back()).toBe(false);
    await flush();
    expect(nav.committed).toEqual(["traverse http://localhost/a"]);
  });

  it("replays a cross-document push and replace with the same history behaviour", async () => {
    const { result } = renderHook(() => useBlocker({ shouldBlockFn: () => true, withResolver: true }));

    act(() => void nav.fire({ navigationType: "push", url: "http://localhost/plain" }));
    await flush();
    expect(result.current.action).toBe("PUSH");
    act(() => result.current.proceed?.());
    await flush();
    expect(nav.navigation.navigate).toHaveBeenLastCalledWith("http://localhost/plain", {
      history: "push",
      state: { from: "state" },
    });

    act(() => void nav.fire({ navigationType: "replace", url: "http://localhost/swap" }));
    await flush();
    expect(result.current.action).toBe("REPLACE");
    act(() => result.current.proceed?.());
    await flush();
    expect(nav.navigation.navigate).toHaveBeenLastCalledWith("http://localhost/swap", {
      history: "replace",
      state: { from: "state" },
    });
    expect(nav.committed).toEqual(["push http://localhost/plain", "replace http://localhost/swap"]);
  });

  it("lets the replay of a cross-document navigation unload without asking again", async () => {
    const { result } = renderHook(() => useBlocker({ shouldBlockFn: () => true, withResolver: true }));
    act(() => void nav.fire({ navigationType: "push", url: "http://localhost/plain" }));
    await flush();
    act(() => result.current.proceed?.());
    await flush();
    expect(unload()).toBe(false);
    expect(unload()).toBe(true);
  });

  it("leaves reload to beforeunload", () => {
    const shouldBlockFn = vi.fn(() => true);
    renderHook(() => useBlocker({ shouldBlockFn }));
    expect(nav.fire({ navigationType: "reload", url: location.href })).toBe(true);
    expect(shouldBlockFn).not.toHaveBeenCalled();
    expect(unload()).toBe(true);
  });

  it("ignores a same-document push, a POST and a navigation it cannot cancel", () => {
    const shouldBlockFn = vi.fn(() => true);
    renderHook(() => useBlocker({ shouldBlockFn }));
    // A router writing the URL of a page it has already rendered.
    expect(nav.fire({ navigationType: "push", url: "http://localhost/next", sameDocument: true })).toBe(true);
    expect(nav.fire({ navigationType: "push", url: "http://localhost/post", formData: new FormData() })).toBe(true);
    expect(nav.fire({ navigationType: "traverse", url: "http://localhost/a", cancelable: false })).toBe(true);
    expect(shouldBlockFn).not.toHaveBeenCalled();
  });
});

describe("more than one blocker", () => {
  it("asks in registration order and stops at the first that blocks", () => {
    const calls: string[] = [];
    renderHook(() => {
      useBlocker({ shouldBlockFn: () => (calls.push("first"), false) });
      useBlocker({ shouldBlockFn: () => (calls.push("second"), true) });
      useBlocker({ shouldBlockFn: () => (calls.push("third"), true) });
    });
    expect(nav.back()).toBe(false);
    expect(calls).toEqual(["first", "second"]);
  });

  it("asks the next blocker only after the first one's proceed", async () => {
    const second = vi.fn(() => true);
    const { result } = renderHook(() => ({
      first: useBlocker({ shouldBlockFn: () => true, withResolver: true }),
      second: useBlocker({ shouldBlockFn: second }),
    }));
    act(() => void nav.back());
    await flush();
    expect(second).not.toHaveBeenCalled();
    act(() => result.current.first.proceed?.());
    await flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(nav.committed).toEqual([]);
  });

  it("keeps its place in the order when its options change identity", () => {
    const calls: string[] = [];
    const { rerender } = renderHook(() => {
      useBlocker({ shouldBlockFn: () => (calls.push("first"), false) });
      useBlocker({ shouldBlockFn: () => (calls.push("second"), false) });
    });
    rerender();
    rerender();
    nav.back();
    expect(calls).toEqual(["first", "second"]);
  });
});

describe("a guard that fails", () => {
  it("lets the navigation through and hands onFailure the rejection, whole", async () => {
    const thrown = { code: "form/unreadable" };
    const onFailure = vi.fn();
    renderHook(() => useBlocker({ shouldBlockFn: () => Promise.reject(thrown), withResolver: true, onFailure }));
    expect(nav.back()).toBe(false);
    await flush();
    expect(nav.committed).toEqual(["traverse http://localhost/a"]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]![0]).toBe(thrown);
  });

  it("lets the navigation through when shouldBlockFn throws, and hands onFailure the throw", () => {
    const thrown = new Error("the form is gone");
    const onFailure = vi.fn();
    renderHook(() =>
      useBlocker({
        shouldBlockFn: () => {
          throw thrown;
        },
        onFailure,
      }),
    );
    expect(nav.back()).toBe(true);
    expect(onFailure).toHaveBeenCalledWith(thrown);
  });
});
