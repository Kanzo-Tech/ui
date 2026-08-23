import { describe, expect, it } from "vitest";
import { type Shared, decode, encode } from "./link";

/**
 * What a link owes.
 *
 * Two halves, and the second is the one worth writing down. A round-trip test proves the encoder
 * and the decoder agree with each other, which they would even if both were wrong in the same way.
 * What actually protects the studio is the other direction: **every malformed fragment answers
 * `null`**, because the fragment is a string from a stranger and its values end up in a `style`
 * attribute.
 */

const THEME: Shared = {
  name: "acme",
  dark: false,
  tokens: {
    "--background": "#fafafa",
    "--foreground": "#0f0f0f",
    "--primary": "#0f0f0f",
    "--primary-foreground": "#fafafa",
    "--radius-box": "0.75rem",
    "--font-sans": "ui-sans-serif, system-ui, sans-serif",
  },
};

describe("a theme in a fragment", () => {
  it("comes back the same", async () => {
    expect(await decode(await encode(THEME))).toEqual(THEME);
  });

  it("takes the fragment with or without its hash", async () => {
    const fragment = await encode(THEME);
    expect(await decode(`#${fragment}`)).toEqual(await decode(fragment));
  });

  it("stays shorter than the document it carries", async () => {
    // The reason compression is here at all. Not a tight bound — a guard on the mechanism, not on
    // the ratio: if `CompressionStream` silently stopped compressing, the link would still work and
    // nothing else would notice.
    const fragment = await encode(THEME);
    expect(fragment.length).toBeLessThan(JSON.stringify(THEME).length);
  });

  it("survives every shape of nonsense", async () => {
    // This also guards something it does not assert, and the distinction is worth knowing: feeding
    // a decompressor garbage rejects on *both* ends of the stream, and the one nobody awaits is an
    // unhandled rejection. Vitest fails a run on those even when every expectation passed — which
    // is how it was found, with seven green tests and a red process.
    const rubbish = [
      "",
      "#",
      "theme=",
      "theme=!!!!",
      "theme=aGVsbG8", // valid base64, not deflate
      "#theme=eJwrSU0uUbBSMDIwMlXQtVBQyMwrKS0qLbEGACpSBaA", // deflate of something that is not ours
      "notatheme=abc",
      "#other=eJwr",
    ];
    for (const value of rubbish) expect(await decode(value), value).toBeNull();
  });

  it("drops anything in the payload that is not a token holding a string", async () => {
    // `JSON.parse` will hand back nested objects, arrays and numbers, and each of those would reach
    // a `style` attribute as `[object Object]` or worse. Keys that are not custom properties go the
    // same way: nothing else has any business being written onto the pane.
    const smuggled = await encode({
      name: "x",
      dark: false,
      tokens: {
        "--good": "#ffffff",
        "--nested": { toString: "no" } as unknown as string,
        "--number": 7 as unknown as string,
        onclick: "alert(1)",
        "background: red": "x",
      },
    });
    expect((await decode(smuggled))?.tokens).toEqual({ "--good": "#ffffff" });
  });

  it("answers null when nothing survives the filter", async () => {
    const empty = await encode({ name: "x", dark: false, tokens: { nope: "1" } });
    expect(await decode(empty)).toBeNull();
  });

  it("keeps the name and the side it was given", async () => {
    const dark = await decode(await encode({ ...THEME, name: "midnight", dark: true }));
    expect(dark?.name).toBe("midnight");
    expect(dark?.dark).toBe(true);
  });
});
