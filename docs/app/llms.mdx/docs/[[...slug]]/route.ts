import { notFound } from "next/navigation";
import { source } from "@/lib/source";

export const revalidate = false;

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  // `raw` (the file off disk), not `processed`: processed Markdown would need
  // `includeProcessedMarkdown` enabled in source.config.ts.
  return new Response(await page.data.getText("raw"), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
