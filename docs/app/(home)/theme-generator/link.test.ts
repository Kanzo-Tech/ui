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

const LIGHT = {
  "--background": "#fafafa",
  "--foreground": "#0f0f0f",
  "--primary": "#0f0f0f",
  "--primary-foreground": "#fafafa",
  "--radius-box": "0.75rem",
  "--font-sans": "ui-sans-serif, system-ui, sans-serif",
};
const DARK = { ...LIGHT, "--background": "#0a0a0a", "--foreground": "#efefef" };
const THEME: Shared = { family: "acme", light: LIGHT, dark: DARK };

/** The single-theme format links were made in before pairs, written the way that encoder wrote it. */
async function legacy(payload: unknown): Promise<string> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(new TextEncoder().encode(JSON.stringify(payload)));
  void writer.close();
  const bytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `theme=${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

describe("a theme family in a fragment", () => {
  it("comes back the same, both sides", async () => {
    expect(await decode(await encode(THEME))).toEqual(THEME);
  });

  it("takes the fragment with or without its hash", async () => {
    const fragment = await encode(THEME);
    expect(await decode(`#${fragment}`)).toEqual(await decode(fragment));
  });

  it("stays shorter than the document it carries", async () => {
    // A guard on the mechanism, not on the ratio: if `CompressionStream` silently stopped
    // compressing, the link would still work and nothing else would notice.
    const fragment = await encode(THEME);
    expect(fragment.length).toBeLessThan(JSON.stringify(THEME).length);
  });

  it("carries one side alone, and says the other is missing", async () => {
    const half = await decode(await encode({ family: "acme", light: LIGHT, dark: null }));
    expect(half).toEqual({ family: "acme", light: LIGHT, dark: null });
  });

  it("still opens a link made in the single-theme format, as the side it declared", async () => {
    expect(await decode(await legacy({ n: "midnight-dark", d: true, t: DARK }))).toEqual({
      family: "midnight",
      light: null,
      dark: DARK,
    });
    expect(await decode(await legacy({ n: "acme", d: false, t: LIGHT }))).toEqual({
      family: "acme",
      light: LIGHT,
      dark: null,
    });
  });

  it("survives every shape of nonsense", async () => {
    // Feeding a decompressor garbage rejects on *both* ends of the stream, and the one nobody awaits
    // is an unhandled rejection — Vitest fails a run on those even when every expectation passed.
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
    const smuggled = await encode({
      family: "x",
      light: {
        "--good": "#ffffff",
        "--nested": { toString: "no" } as unknown as string,
        "--number": 7 as unknown as string,
        onclick: "alert(1)",
        "background: red": "x",
      },
      dark: null,
    });
    expect((await decode(smuggled))?.light).toEqual({ "--good": "#ffffff" });
  });

  it("answers null when nothing survives the filter", async () => {
    expect(await decode(await encode({ family: "x", light: { nope: "1" }, dark: { nope: "2" } }))).toBeNull();
    expect(await decode(await legacy({ n: "x", d: false, t: { nope: "1" } }))).toBeNull();
  });
});
