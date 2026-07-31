import { paletteCss } from "@/lib/palette";

/**
 * A compiled palette document, as a stylesheet the browser can fetch.
 *
 * The server picks the document for the FIRST paint, from the cookie, and inlines it — that is what
 * makes a reload flash-free. This route is the other half: switching palettes has to repaint *now*,
 * not on the next navigation, and a 5 KB fetch is the cheapest way to get the bytes into a page that
 * did not ship with them.
 *
 * Shipping all five up front was the alternative and it is worse in both directions: every visitor
 * pays for four documents they will not use, and the page still needs a mechanism to choose between
 * them. Fetching means the common case — one palette — costs exactly nothing.
 *
 * Immutable, because it is: a document is derived once and compiled deterministically, so the bytes
 * for an id never change. A new palette is a new id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const css = paletteCss(id);
  // 404 rather than an empty sheet: the default palette has no stylesheet of its own (it is
  // `tokens.css`), and an unknown id is a typo or a retired document. Silence would leave the page
  // painted with whatever it had and no way to tell that from success.
  if (!css) return new Response("Not found", { status: 404 });

  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
