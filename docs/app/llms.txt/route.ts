import { llms } from "fumadocs-core/source";
import { source } from "@/lib/source";

export const revalidate = false;

const INTRO =
  "A domain-free component library built on Ark UI + Tailwind, token-themed. Ark supplies behaviour and accessibility; Kanzo adds the styled vocabulary, layout shells, and full-arrangement showcases. `kebab-case` names are the vendored primitives; `PascalCase` are the pre-assembled conveniences built on top.";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const index = llms(source);

  // Section titles and order come from the page tree (the `meta.json` files), so the index
  // cannot drift from the sidebar.
  const out = [
    "# Kanzo UI",
    "",
    `> ${INTRO}`,
    "",
    `Paths below are relative to ${origin}. Append \`.mdx\` to any page URL for its Markdown source — e.g. ${origin}/docs/actions/button.mdx.`,
    "",
    ...source.pageTree.children.map((node) => index.indexNode(node)),
    "",
  ];

  return new Response(out.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
