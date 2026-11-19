import { describe, expect, it } from "vitest";
import { type OfferEvent, askable, cleanGhost, nextWord, offers } from "./offers.js";

const VALUE = "Three hounds seen";

/** Offers holding `texts` made at the end of `value`, the last on the table, streamed whole and painted. */
function offered(texts: string[], { value = VALUE, done = true, painted = true } = {}) {
  const s = offers();
  s.type(value, value.length);
  for (const text of texts) {
    const { offer } = s.open();
    s.arrive(offer, text);
    if (done) s.end(offer, false);
  }
  if (painted) s.show();
  return s;
}

const kinds = (events: OfferEvent[] | null) => events?.map((e) => e.kind) ?? null;

describe("an offer survives typing that agrees with it", () => {
  it.each([
    ["typing what it says", `${VALUE} at`, " the ford.", true],
    ["typing all of it", `${VALUE} at the ford.`, "", true],
    ["typing something else", `${VALUE} by`, "", false],
    ["deleting before where it was made", "Three hounds see", "", false],
  ])("on %s", (_, value, ghost, kept) => {
    const s = offered([" at the ford."]);
    expect(s.type(value, value.length) === null).toBe(kept);
    expect(s.ghost()).toBe(ghost);
  });

  it("asks nothing new while it survives, and reports the one it lost as ignored", () => {
    const s = offered([" at the ford."]);
    expect(s.type(`${VALUE} at`, 20)).toBeNull();
    const lost = s.type(`${VALUE} by`, 20);
    expect(lost?.map((e) => [e.kind, e.proposal.value])).toEqual([["ignored", " at the ford."]]);
  });

  it("survives typing ahead of a stream still arriving, and not once it has ended", () => {
    const value = `${VALUE} at the`;
    expect(offered([" at"], { done: false }).type(value, value.length)).toBeNull();
    expect(offered([" at"]).type(value, value.length)).not.toBeNull();
  });

  it.each([
    ["three characters", "abc", false],
    ["four in spaces", "  ab ", false],
    ["four characters", "abcd", true],
  ])("asks after %s only when there is enough to continue", (_, value, ask) => {
    expect(askable(value)).toBe(ask);
  });
});

describe("what the host is told", () => {
  it("reports an offer shown once, and only when some of it is on screen", () => {
    const s = offered([" at the ford."], { painted: false });
    expect(kinds(s.show())).toEqual(["shown"]);
    expect(kinds(s.show())).toEqual([]);
    expect(kinds(offered(["Three hounds"], { painted: false }).show())).toEqual([]);
  });

  it.each([
    ["rejected", true, ["rejected"]],
    ["ignored", true, ["ignored"]],
    ["rejected", false, []],
    [undefined, true, []],
  ] as const)("drops every offer, reporting %s only for one on screen (shown: %s)", (why, painted, events) => {
    const s = offered([" at the ford."], { painted });
    expect(kinds(s.drop(why))).toEqual(events);
    expect(s.ghost()).toBe("");
    expect(s.turn(1)).toBe("more");
  });

  it.each([
    ["accepted", " at the ford.", ""],
    ["partial", " at", " the ford."],
  ] as const)("reports a take as %s, of the text taken at the caret", (kind, text, left) => {
    const s = offered([" at the ford."]);
    expect(s.take(kind, text)).toEqual([{ kind, proposal: expect.objectContaining({ value: text, target: { insert: 17 } }) }]);
    s.type(`${VALUE}${text}`, 17 + text.length);
    expect(s.ghost()).toBe(left);
  });

  it("reports nothing taken when nothing is on offer", () => {
    expect(offers().take("accepted", " at")).toEqual([]);
  });
});

describe("alternatives at one point", () => {
  it("keeps the offers made at the same point, and asks for one that differs from them", () => {
    const s = offered([" at the ford."]);
    expect(s.open().avoid).toEqual([" at the ford."]);
    expect(s.open().avoid).toEqual([" at the ford.", ""]);
  });

  it("forgets the offers made anywhere else, even one still on the table", () => {
    const s = offered([" at the ford."]);
    s.type(`${VALUE} at`, 20);
    expect(s.open().avoid).toEqual([]);
    expect(s.turn(-1)).toBe(false);
  });

  it("turns back and forth between them, and past the last asks for more", () => {
    const s = offered([" at the ford.", " by the mill."]);
    expect(s.ghost()).toBe(" by the mill.");
    expect(s.turn(1)).toBe("more");
    expect(s.turn(-1)).toBe(true);
    expect(s.ghost()).toBe(" at the ford.");
    expect(s.turn(-1)).toBe(false);
    expect(s.ghost()).toBe(" at the ford.");
  });

  it("reports each alternative shown when it is turned to, again on returning to one", () => {
    const s = offered([" at the ford.", " by the mill."]);
    s.turn(-1);
    expect(s.show()?.map((e) => [e.kind, e.proposal.value])).toEqual([["shown", " at the ford."]]);
    expect(kinds(s.show())).toEqual([]);
  });

  it("asks again at the same point without dropping what is there, and drops it anywhere else", () => {
    const s = offered([" at the ford."]);
    expect(s.invoke(VALUE, 17)).toBeNull();
    expect(s.ghost()).toBe(" at the ford.");
    expect(kinds(s.invoke(VALUE, 5))).toEqual(["ignored"]);
    expect(s.ghost()).toBe("");
  });
});

describe("a stream's chunks", () => {
  it("stop once their offer is no longer on the table", () => {
    const s = offers();
    s.type(VALUE, 17);
    const first = s.open().offer;
    const second = s.open().offer;
    expect(s.arrive(first, " at")).toBe(false);
    expect(s.arrive(second, " by")).toBe(true);
    expect(s.ghost()).toBe(" by");
  });

  it("are not an offer when the stream fails, but an alternative's failure behind it leaves it be", () => {
    const s = offers();
    s.type(VALUE, 17);
    const { offer } = s.open();
    s.arrive(offer, " at the");
    expect(s.end(offer, true)).toBe(true);
    expect(s.ghost()).toBe("");

    const t = offered([" at"]);
    const behind = t.open().offer;
    t.arrive(behind, " by");
    t.turn(-1);
    expect(t.end(behind, true)).toBe(false);
    t.turn(1);
    expect(t.ghost()).toBe(" by");
  });

  it.each([
    ["a continuation", "Three hounds", " seen at dusk", " seen at dusk"],
    ["a restated value", "Three hounds", "Three hounds seen", " seen"],
    ["an echo still arriving", "Three hounds", "Three ho", ""],
    ["no value", "", "Three", "Three"],
  ])("clean %s", (_, base, cont, ghost) => {
    expect(cleanGhost(base, cont)).toBe(ghost);
  });
});

describe("one word at a time", () => {
  it.each([
    [" at the ford.", " at"],
    ["ford.", "ford."],
    ["  \n", ""],
    ["", ""],
  ])("takes %j as %j", (ghost, word) => {
    expect(nextWord(ghost)).toBe(word);
  });
});
