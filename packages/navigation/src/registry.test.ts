import { afterEach, describe, expect, it, vi } from "vitest";
import { blockers, guard, locationOf } from "./registry";

const args = { current: locationOf("https://a.test/"), next: locationOf("https://a.test/b"), action: "PUSH" as const };

afterEach(() => {
  blockers.length = 0;
});

describe("guard, the one reading of a verdict every door shares", () => {
  it.each([
    ["nothing blocks", false, { through: true, cancelled: false, replayed: false }],
    ["a blocker says true", true, { through: false, cancelled: true, replayed: false }],
    ["a pending verdict lets it through", Promise.resolve(false), { through: false, cancelled: true, replayed: true }],
    ["a pending verdict blocks", Promise.resolve(true), { through: false, cancelled: true, replayed: false }],
  ])("%s", async (_, verdict, expected) => {
    blockers.push({ fn: () => verdict, enableBeforeUnload: () => false });
    const cancel = vi.fn();
    const replay = vi.fn();
    const through = guard(args, { cancel, replay });
    await Promise.resolve();
    await Promise.resolve();
    expect({ through, cancelled: cancel.mock.calls.length === 1, replayed: replay.mock.calls.length === 1 }).toEqual(expected);
  });

  it("goes through with no blocker at all", () => {
    const replay = vi.fn();
    expect(guard(args, { replay })).toBe(true);
    expect(replay).not.toHaveBeenCalled();
  });
});
