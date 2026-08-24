import { notFound } from "next/navigation";
import { source } from "@/lib/source";

/**
 * A documentation page's Markdown source, served at `/docs/<slug>.mdx`.
 *
 * ## The `.mdx` is part of the emitted PATH, and that is the whole design of this file
 *
 * A static export writes one file per route, so two routes may not want the same name — and in a
 * documentation tree they constantly do. `/docs/ai` is a page *and* the parent of
 * `/docs/ai/use-suggestions`, so the export asks for `out/…/docs/ai` to be a file and a directory
 * at once and dies with `EISDIR`. It is not a corner case: every section index in the site is one.
 *
 * Appending the extension to the last segment of the static params settles it by construction —
 * `docs/ai.mdx` is a file, `docs/ai/` is a directory, and no name is ever both. `GET` strips it
 * back off to look the page up, so the two halves are the same string with a suffix.
 *
 * It also means the exported tree already mirrors the URLs a reader uses, and
 * `scripts/materialise-mdx.mjs` only has to move it up rather than rename anything.
 *
 * The server build reaches these through `rewrites()` instead, which is why the suffix is stripped
 * rather than required: `/docs/ai.mdx` rewrites to `/llms.mdx/docs/ai.mdx` there, and to
 * `/llms.mdx/docs/ai` before this change. Same address either way.
 */
export const revalidate = false;

const SUFFIX = ".mdx";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  // Tolerated with or without the suffix: the export asks for it, a rewrite may not.
  const last = slug.at(-1) ?? "";
  const path = last.endsWith(SUFFIX) ? [...slug.slice(0, -1), last.slice(0, -SUFFIX.length)] : slug;

  const page = source.getPage(path);
  if (!page) notFound();

  // `raw` (the file off disk), not `processed`: processed Markdown would need
  // `includeProcessedMarkdown` enabled in source.config.ts.
  return new Response(await page.data.getText("raw"), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}

/** The index page is `../../docs-index/route.ts`'s, so an empty slug is dropped here. */
export function generateStaticParams() {
  return source
    .generateParams()
    .map((p) => p.slug ?? [])
    .filter((slug) => slug.length > 0)
    .map((slug) => ({ slug: [...slug.slice(0, -1), `${slug.at(-1)}${SUFFIX}`] }));
}
