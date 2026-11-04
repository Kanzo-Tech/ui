import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { MarkdownCopyButton, ViewOptionsPopover } from "fumadocs-ui/layouts/docs/page";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { UpstreamLinks } from "@/components/upstream-links";
import { baseUrl, ogImageUrl, siteName } from "@/lib/metadata";

/** fumadocs' page actions, unfilled and in muted ink: tools beside the page, not its first block. */
const PAGE_ACTION =
  "border-0 bg-transparent text-sm font-normal text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = `${page.url}.mdx`;

  return (
    <DocsPage
      breadcrumb={{ enabled: false }}
      // One measure for every reading page — fumadocs' 900px column ran prose to ~110 characters.
      // A `full` page is a gallery and keeps fumadocs' wide column.
      className={page.data.full ? undefined : "max-w-[49rem]"}
      full={page.data.full}
      toc={page.data.toc}
    >
      <DocsTitle className="text-[2rem] leading-tight tracking-[-0.02em]">{page.data.title}</DocsTitle>
      <DocsDescription className="-mt-2 mb-0 text-base">{page.data.description}</DocsDescription>
      <div className="-ms-2 flex flex-row flex-wrap items-center gap-1">
        <MarkdownCopyButton className={PAGE_ACTION} markdownUrl={markdownUrl} />
        <ViewOptionsPopover className={PAGE_ACTION} markdownUrl={markdownUrl} />
        <UpstreamLinks className={PAGE_ACTION} links={page.data.links} />
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
