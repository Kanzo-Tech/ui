import { notFound } from "next/navigation";
import { source } from "@/lib/source";

/**
 * The docs INDEX page's Markdown source, on a route of its own — served at `/docs.mdx`.
 *
 * **It was the empty-slug case of `[[...slug]]` next door, and a static export cannot have both.**
 * An optional catch-all asks for one path to be a file (`out/llms.mdx/docs`, the root case) and a
 * directory (`out/llms.mdx/docs/actions/button`, every other page) at the same time, and the export
 * fails with `EISDIR` at the copy — after prerendering all 434 pages, so it reads as a late failure
 * of something else entirely. Splitting the root out is the whole fix: the sibling is a REQUIRED
 * catch-all now, so `out/llms.mdx/docs` is only ever a directory.
 *
 * The address a reader uses does not change. `/docs.mdx` reaches here through a rewrite in the
 * server build and through a file `scripts/materialise-mdx.mjs` writes in the exported one.
 */
export const revalidate = false;

export async function GET() {
  const page = source.getPage([]);
  if (!page) notFound();

  return new Response(await page.data.getText("raw"), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
