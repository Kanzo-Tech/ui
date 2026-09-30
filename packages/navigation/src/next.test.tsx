import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ComponentProps, MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, useRouter } from "./next";
import { useBlocker } from "./use-blocker";

/**
 * `next/link` and `next/navigation` stood in for by the three behaviours this door relies on, and
 * nothing else: `Link` calls `onClick`, then `onNavigate` with a `preventDefault`, then dispatches
 * unless it was prevented; and `useRouter` hands back one stable instance. That the real `Link`
 * still does this, in this order, is the e2e fixture's claim — see `docs/scripts/navigation-guard.e2e.mjs`.
 */
const dispatched = vi.fn();
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    onNavigate,
    children,
    replace,
  }: {
    href: string | { pathname: string };
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    onNavigate?: (event: { preventDefault: () => void }) => void;
    children?: React.ReactNode;
    replace?: boolean;
    scroll?: boolean;
    as?: string;
  }) => (
    <a
      href={typeof href === "string" ? href : href.pathname}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
        let prevented = false;
        onNavigate?.({ preventDefault: () => (prevented = true) });
        if (!prevented) dispatched(href, replace ? "replace" : "push");
      }}
    >
      {children}
    </a>
  ),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const flush = () => act(async () => {});

function Guarded(props: Partial<ComponentProps<typeof Link>> & { block: boolean }) {
  const { block, ...link } = props;
  const blocker = useBlocker({ shouldBlockFn: () => block, withResolver: true, enableBeforeUnload: false });
  return (
    <>
      <Link href="/elsewhere" {...link}>
        go
      </Link>
      <output>{blocker.status}</output>
      <output>{blocker.action}</output>
      <output>{blocker.next?.pathname}</output>
      <button onClick={blocker.proceed}>leave</button>
      <button onClick={blocker.reset}>stay</button>
    </>
  );
}

describe("Link", () => {
  it("navigates as next/link does when nothing blocks", () => {
    render(<Guarded block={false} />);
    fireEvent.click(screen.getByText("go"));
    expect(dispatched).toHaveBeenCalledWith("/elsewhere", "push");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("cancels in onNavigate and re-issues the push on proceed", async () => {
    render(<Guarded block scroll={false} />);
    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(dispatched).not.toHaveBeenCalled();
    expect(screen.getByText("blocked")).toBeTruthy();
    expect(screen.getByText("PUSH")).toBeTruthy();
    expect(screen.getByText("/elsewhere")).toBeTruthy();

    fireEvent.click(screen.getByText("leave"));
    await flush();
    expect(router.push).toHaveBeenCalledWith("/elsewhere", { scroll: false });
    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("stays on reset", async () => {
    render(<Guarded block />);
    fireEvent.click(screen.getByText("go"));
    await flush();
    fireEvent.click(screen.getByText("stay"));
    await flush();
    expect(router.push).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
  });

  it("re-issues a replace link as a replace", async () => {
    render(<Guarded block replace />);
    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(screen.getByText("REPLACE")).toBeTruthy();
    fireEvent.click(screen.getByText("leave"));
    await flush();
    expect(router.replace).toHaveBeenCalledWith("/elsewhere", { scroll: undefined });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("formats a URL object the way router.push takes it", async () => {
    render(<Guarded block href={{ pathname: "/runs", query: { page: "2", tag: ["a", "b"] }, hash: "top" }} />);
    fireEvent.click(screen.getByText("go"));
    await flush();
    fireEvent.click(screen.getByText("leave"));
    await flush();
    expect(router.push).toHaveBeenCalledWith("/runs?page=2&tag=a&tag=b#top", { scroll: undefined });
  });

  it("does not consult the blockers when the caller's own onNavigate prevented it", () => {
    const shouldBlockFn = vi.fn(() => true);
    function Own() {
      useBlocker({ shouldBlockFn });
      return (
        <Link href="/elsewhere" onNavigate={(event) => event.preventDefault()}>
          go
        </Link>
      );
    }
    render(<Own />);
    fireEvent.click(screen.getByText("go"));
    expect(shouldBlockFn).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
  });
});

describe("useRouter", () => {
  it("guards push and replace, and replays them with their options on proceed", async () => {
    const { result } = renderHook(() => ({
      blocker: useBlocker({ shouldBlockFn: () => true, withResolver: true, enableBeforeUnload: false }),
      router: useRouter(),
    }));

    act(() => result.current.router.push("/runs/7", { scroll: false }));
    await flush();
    expect(router.push).not.toHaveBeenCalled();
    expect(result.current.blocker).toMatchObject({ status: "blocked", action: "PUSH", next: { pathname: "/runs/7" } });
    act(() => result.current.blocker.proceed?.());
    await flush();
    expect(router.push).toHaveBeenCalledWith("/runs/7", { scroll: false });

    act(() => result.current.router.replace("/runs/8"));
    await flush();
    expect(result.current.blocker.action).toBe("REPLACE");
    act(() => result.current.blocker.reset?.());
    await flush();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("calls through synchronously when nothing blocks", () => {
    const { result } = renderHook(() => {
      useBlocker({ shouldBlockFn: () => false, enableBeforeUnload: false });
      return useRouter();
    });
    result.current.push("/runs");
    expect(router.push).toHaveBeenCalledWith("/runs", undefined);
  });

  it("leaves back, forward, refresh and prefetch as Next's own", () => {
    const { result } = renderHook(() => useRouter());
    expect(result.current.back).toBe(router.back);
    expect(result.current.forward).toBe(router.forward);
    expect(result.current.refresh).toBe(router.refresh);
    expect(result.current.prefetch).toBe(router.prefetch);
  });
});
