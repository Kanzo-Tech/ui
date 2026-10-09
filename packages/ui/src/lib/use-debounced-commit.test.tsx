import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DebouncedCommit, useDebouncedCommit } from "./use-debounced-commit.js";

function mount(initial: string, delay?: number) {
  const commits: string[] = [];
  const box: { api?: DebouncedCommit<string>; value: string } = { value: initial };
  function Probe({ value }: { value: string }) {
    box.api = useDebouncedCommit(value, (next) => commits.push(next), delay);
    return null;
  }
  const view = render(<Probe value={initial} />);
  return {
    commits,
    get api() {
      return box.api!;
    },
    setValue: (value: string) => view.rerender(<Probe value={value} />),
  };
}

describe("useDebouncedCommit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows each keystroke at once and commits only the last one, after the pause", () => {
    const t = mount("");

    act(() => t.api.change("h"));
    act(() => vi.advanceTimersByTime(100));
    act(() => t.api.change("ht"));
    act(() => vi.advanceTimersByTime(100));
    act(() => t.api.change("htt"));

    expect(t.api.draft).toBe("htt");
    expect(t.commits).toEqual([]);

    act(() => vi.advanceTimersByTime(250));
    expect(t.commits).toEqual(["htt"]);
  });

  it("commits a pending draft on flush and then has nothing left to fire", () => {
    const t = mount("");

    act(() => t.api.change("http"));
    act(() => t.api.flush());
    act(() => vi.advanceTimersByTime(1000));

    expect(t.commits).toEqual(["http"]);
  });

  it("does nothing on flush when nothing is pending", () => {
    const t = mount("a");

    act(() => t.api.flush());

    expect(t.commits).toEqual([]);
  });

  it("lets a pick supersede typing", () => {
    const t = mount("");

    act(() => t.api.change("ht"));
    act(() => t.api.commit("http://example.org"));
    act(() => vi.advanceTimersByTime(1000));

    expect(t.commits).toEqual(["http://example.org"]);
    expect(t.api.draft).toBe("http://example.org");
  });

  it("follows the owner's value when nothing is pending, and not while the user is typing", () => {
    const t = mount("a");

    t.setValue("b");
    expect(t.api.draft).toBe("b");

    act(() => t.api.change("bc"));
    t.setValue("z");
    expect(t.api.draft).toBe("bc");
  });

  it("hands commit's caller the write onCommit answered, and leaves nothing unhandled where nobody awaits it", async () => {
    const refused = new Error("refused");
    const writes: Promise<void>[] = [];
    let api!: DebouncedCommit<string, Promise<void>>;
    function Probe() {
      api = useDebouncedCommit("", (next) => {
        const write = next === "bad" ? Promise.reject(refused) : Promise.resolve();
        writes.push(write);
        return write;
      });
      return null;
    }
    render(<Probe />);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    let written!: Promise<void>;
    act(() => {
      written = api.commit("bad");
    });
    expect(written).toBe(writes[0]);
    await expect(written).rejects.toBe(refused);

    act(() => api.change("bad"));
    act(() => vi.advanceTimersByTime(250));
    act(() => api.change("bad"));
    act(() => api.flush());
    await vi.waitFor(() => expect(writes).toHaveLength(3));
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
