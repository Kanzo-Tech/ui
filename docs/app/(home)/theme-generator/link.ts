/**
 * A theme family — its light and dark sides — in a URL.
 *
 * The reference's best idea after the swatch pair, and the one that makes the studio worth opening
 * twice: a theme you cannot send to anybody is a theme that lives in one tab. daisyUI's generator
 * puts the whole document in the fragment — the link that started this work was one — and a
 * fragment never reaches a server, so a client's unreleased palette stays on their machine.
 *
 * ## Why compressed, and why self-describing
 *
 * The document is about 970 bytes of JSON, which is 1,296 characters of base64 and an ugly link.
 * `deflate-raw` takes it to 459, the same order as daisyUI's own. `CompressionStream` is native, so
 * this costs no dependency; it is asynchronous, which is the whole of the price.
 *
 * The keys travel in full. Stripping `--` off every one of them saves seven characters — deflate
 * had already eaten the repetition — and costs the property that matters: a link made today still
 * decodes when the token list grows, because the payload says what each value is rather than
 * relying on both ends agreeing about an order.
 *
 * ## What it cannot do
 *
 * **Fail loudly.** {@link decode} answers `null` for anything it cannot read — a truncated link, a
 * hand-edited one, a fragment from a future version. A studio that threw on a bad fragment would
 * be a studio that a mistyped URL can break, and the fallback is always available and always
 * correct: seed from a shipped theme instead.
 */

/**
 * What a link carries: a family — its name and every value of each side. A side is `null` when the
 * link did not carry it, which is what a link made before pairs decodes to for its other side.
 */
export interface Shared {
  family: string;
  light: Record<string, string> | null;
  dark: Record<string, string> | null;
}

const PREFIX = "theme=";

const toBase64Url = (bytes: Uint8Array<ArrayBuffer>): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/**
 * Push bytes through one of the pair. Same shape both ways, so they cannot drift apart.
 *
 * Both writer promises are caught and dropped, and that is load-bearing rather than tidy. Feed a
 * decompressor something that is not deflate and *both* ends fail: the readable rejects, which
 * {@link decode} catches, and the writable rejects too — separately. Left floating, that second
 * one is an unhandled rejection with nobody's `try` around it, so a caller that handled the error
 * correctly still brought the process down. The tests here pass and the run failed, which is the
 * only reason it was found.
 *
 * Dropping them loses nothing: a failure on the writable side always surfaces on the readable side,
 * which is the one whose value anybody wants.
 */
async function through(bytes: Uint8Array<ArrayBuffer>, kind: "in" | "out"): Promise<Uint8Array<ArrayBuffer>> {
  const transform =
    kind === "in" ? new CompressionStream("deflate-raw") : new DecompressionStream("deflate-raw");
  const writer = transform.writable.getWriter();
  const quietly = () => {};
  writer.write(bytes).catch(quietly);
  writer.close().catch(quietly);
  return new Uint8Array(await new Response(transform.readable).arrayBuffer());
}

/** The fragment for a family — `theme=…`, without the `#`. `v: 2` is the paired format. */
export async function encode(shared: Shared): Promise<string> {
  const payload = JSON.stringify({ v: 2, f: shared.family, l: shared.light, d: shared.dark });
  return PREFIX + toBase64Url(await through(new TextEncoder().encode(payload), "in"));
}

/**
 * A theme back out of a fragment, or `null` if there is not one in there.
 *
 * Takes the fragment with or without its `#`, so a caller can hand it `location.hash` directly and
 * not think about it.
 */
export async function decode(fragment: string): Promise<Shared | null> {
  const body = fragment.replace(/^#/, "");
  if (!body.startsWith(PREFIX)) return null;
  try {
    const bytes = await through(fromBase64Url(body.slice(PREFIX.length)), "out");
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as { v?: unknown; f?: unknown; l?: unknown; d?: unknown; n?: unknown; t?: unknown };
    if (p.v === 2) {
      const [light, dark] = [tokensOf(p.l), tokensOf(p.d)];
      if (!light && !dark) return null;
      return { family: typeof p.f === "string" ? p.f : "untitled", light, dark };
    }
    // The single-theme format: `{ n: name, d: dark, t: tokens }`. Its theme becomes the side it
    // declared, and the family is its name without the `-dark` a night theme carries.
    const tokens = tokensOf(p.t);
    if (!tokens) return null;
    const name = typeof p.n === "string" ? p.n : "untitled";
    const dark = p.d === true;
    return { family: name.replace(/-dark$/, ""), light: dark ? null : tokens, dark: dark ? tokens : null };
  } catch {
    return null;
  }
}

/**
 * Values only — a fragment is a string from a stranger, and the studio writes whatever is in here
 * into a `style` attribute. Anything that is not a custom property holding a plain string is
 * dropped, which also covers the nested-object and array shapes `JSON.parse` will happily make.
 */
function tokensOf(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null) return null;
  const tokens: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("--") && typeof v === "string") tokens[key] = v;
  }
  return Object.keys(tokens).length > 0 ? tokens : null;
}
