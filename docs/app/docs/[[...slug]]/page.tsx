import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { ExternalLinkIcon } from "lucide-react";
import { Show } from "@kanzo-tech/ui";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const doc = page.data.links?.doc;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {/* The `links.doc` frontmatter, rendered where Shark renders it: a row under the title,
          pointing at the upstream page this component wraps. Collected on 55 pages and shown on
          none until this existed. */}
      <Show when={Boolean(doc)}>
        <div className="not-prose mb-6 flex flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-1.5 rounded-md border bg-fd-secondary/50 px-2.5 py-1 text-fd-muted-foreground text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            href={doc}
            rel="noreferrer noopener"
            target="_blank"
          >
            Ark UI docs
            <ExternalLinkIcon aria-hidden className="size-3.5" />
          </a>
        </div>
      </Show>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
