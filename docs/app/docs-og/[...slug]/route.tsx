import { notFound } from "next/navigation";
import { generateOGImage } from "fumadocs-ui/og";
import { source } from "@/lib/source";
import { siteName } from "@/lib/metadata";

// The trailing `image.png` is a filename, not part of the page slug — strip it before the lookup.
export async function GET(_request: Request, props: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await props.params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: siteName,
  });
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: [...(params.slug ?? []), "image.png"],
  }));
}
