import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { KanzoLogo } from "@/components/kanzo-logo";
import { source } from "@/lib/source";

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

  // kanzo.tech's own pairing: the mist ground, the deep green, the wordmark. Flat — a card is read
  // at thumbnail size in a feed, and a gradient behind the title is the first thing to blur.
  return new ImageResponse(
    (
      <div
        style={{
          background: "#e0e7df",
          color: "#004011",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        }}
      >
        <KanzoLogo height={44} width={228} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {forCard(page.data.title)}
          </div>
          <div style={{ color: "#333333", display: "flex", fontSize: 34, lineHeight: 1.35, maxWidth: 960 }}>
            {forCard(page.data.description)}
          </div>
        </div>
      </div>
    ),
    { height: 630, width: 1200 },
  );
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: [...(params.slug ?? []), "image.png"],
  }));
}
