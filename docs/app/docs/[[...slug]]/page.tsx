import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { MarkdownCopyButton, ViewOptionsPopover } from "fumadocs-ui/layouts/docs/page";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { UpstreamLinks } from "@/components/upstream-links";
import { baseUrl, ogImageUrl, siteName } from "@/lib/metadata";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = `${page.url}.mdx`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {/* One row, so the badge sizes to its content: as a bare child of DocsPage's flex column
          it stretched to the full page width. No `githubUrl` — this repo has no remote. */}
      <div className="flex flex-row flex-wrap items-center gap-2 border-b pt-2 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} />
        <UpstreamLinks links={page.data.links} />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const { title, description } = page.data;
  const image = ogImageUrl(params.slug);

  return {
    metadataBase: baseUrl,
    title,
    description,
    openGraph: { title, description, siteName, type: "article", url: page.url, images: image },
    twitter: { card: "summary_large_image", title, description, images: image },
  };
}
