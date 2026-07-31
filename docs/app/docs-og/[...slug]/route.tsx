import { notFound } from "next/navigation";
import { generateOGImage } from "fumadocs-ui/og";
import { source } from "@/lib/source";
import { siteName } from "@/lib/metadata";

/**
 * Satori's built-in font has no arrows, so a single `⇄` sends the build out to a font CDN — which
 * answers 400, and would make the build depend on the network even when it answers 200. One page
 * uses one arrow. If a build ever warns "Failed to load dynamic font" for another glyph, add it
 * here rather than letting 126 cards wait on a fetch.
 */
const UNRENDERABLE: Record<string, string> = { "⇄": "/" };

const forCard = (text?: string) =>
  text?.replace(/[⇄]/g, (glyph) => UNRENDERABLE[glyph] ?? "");

// The trailing `image.png` is a filename, not part of the page slug — strip it before the lookup.
export async function GET(_request: Request, props: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await props.params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return generateOGImage({
    title: forCard(page.data.title),
    description: forCard(page.data.description),
    site: siteName,
  });
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: [...(params.slug ?? []), "image.png"],
  }));
}
