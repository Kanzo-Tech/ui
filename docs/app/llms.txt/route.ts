import type { Folder, Node } from "fumadocs-core/page-tree";
import { source } from "@/lib/source";

/**
 * llmstxt.org-style index, generated from the live page tree.
 *
 * The tree — not `getPages()` — because the tree is where `meta.json`'s curated order lives.
 * Sorting the flat page list alphabetically discarded it: `Controls` and `Building a form` did
 * not lead Forms, and the `---Text---` / `---Choice---` structure that makes a 30-page group
 * navigable was lost entirely. This file's whole audience is machines, and a machine reading a
 * list has nothing but the order to tell it where to start.
 *
 * It also means there is no second list to keep true: a group's title and position come from its
 * own `meta.json`, so adding or renaming one needs no edit here.
 */

/**
 * The advertised origin.
 *
 * `new URL(request.url).origin` alone is the internal one: behind any reverse proxy the host is
 * whatever the app is bound to, so a deployed file happily advertises `http://0.0.0.0:3000/…` —
 * and a crawl of a dev server advertises `localhost`. `NEXT_PUBLIC_SITE_URL` is the answer for a
 * production build; the forwarded headers are the fallback; the request URL is the last resort,
 * which is exactly right in local development.
 */
function siteOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

function asText(node: unknown, fallback = ""): string {
  return typeof node === "string" ? node : fallback;
}

function linesFor(folder: Folder, origin: string): string[] {
  const out: string[] = [];

  for (const child of folder.children as Node[]) {
    if (child.type === "separator") {
      out.push("", `**${asText(child.name)}**`, "");
      continue;
    }
    if (child.type !== "page") continue;

    const page = source.getNodePage(child);
    const title = page?.data.title ?? asText(child.name);
    const description = page?.data.description ?? asText(child.description);
    out.push(`- [${title}](${origin}${child.url})${description ? `: ${description}` : ""}`);
  }

  return out;
}

export function GET(request: Request) {
  const origin = siteOrigin(request);

  const out: string[] = [
    "# Kanzo UI",
    "",
    "> A domain-free component library built on Ark UI + Tailwind, token-themed. Ark supplies behaviour and accessibility; Kanzo adds the styled vocabulary, layout shells, and full-arrangement showcases. `kebab-case` names are the vendored primitives; `PascalCase` are the pre-assembled conveniences built on top.",
    "",
    // Without this block an agent handed the file cannot write a correct import for a data table
    // or a chart: the page list says what exists, never where it is imported from.
    "## Packages and entry points",
    "",
    "- `@kanzo-tech/ui` — every component. Import `@kanzo-tech/ui/styles.css` once at the root and wrap the app in `KanzoThemeProvider`.",
    "- `@kanzo-tech/ui/table` — the connected data table. Needs `@tanstack/react-table`.",
    "- `@kanzo-tech/ui/analytics` — the charts. Needs `@uwdata/vgplot`, `@uwdata/mosaic-core`, `@uwdata/mosaic-sql`, `@duckdb/duckdb-wasm`.",
    "- `@kanzo-tech/ui/editor` — the CodeMirror editors. Needs `@codemirror/*` and `@lezer/highlight`.",
    "- `@kanzo-tech/theme` — tokens, the axis table, the value types. No React. Installed with the library.",
    "- `@kanzo-tech/palette` — authoring-time colour derivation for a tenant. Installed only where a tenant is onboarded.",
    "",
    "A component that needs one of those engines is two components: the presentational half on the root barrel, the connected half on the subpath. Theming is `data-*` attributes on `<html>` plus a light/dark class — never a wrapper element.",
    "",
  ];

  for (const node of source.pageTree.children as Node[]) {
    if (node.type !== "folder") continue;

    const lines = linesFor(node, origin);
    if (lines.length === 0) continue;

    out.push(`## ${asText(node.name)}`, "", ...lines, "");
  }

  return new Response(out.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
