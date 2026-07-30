import { source } from "@/lib/source";

// llmstxt.org-style index, generated from the live page tree so it never drifts from the docs.
const SECTION_TITLES: Record<string, string> = {
  forms: "Forms",
  actions: "Actions",
  navigation: "Navigation",
  "data-display": "Data display",
  overlays: "Overlays & feedback",
  layout: "Layout",
  showcases: "Showcases",
};
const SECTION_ORDER = [
  "",
  "forms",
  "actions",
  "navigation",
  "data-display",
  "overlays",
  "layout",
  "showcases",
];

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

/**
 * Which section a page belongs to.
 *
 * Keyed off the source directory, not the slug array: `forms/index.mdx` has a single slug, and
 * keying off slug length filed the Forms overview — the page whose description says "start here
 * before reading any individual input page" — outside Forms. `(root)` is a route group, so it
 * carries no section of its own.
 */
function sectionKey(path: string) {
  const [dir] = path.split("/");
  if (!dir || dir.startsWith("(") || !path.includes("/")) return "";
  return dir;
}

export function GET(request: Request) {
  const origin = siteOrigin(request);
  const pages = source.getPages();

  const groups = new Map<string, typeof pages>();
  for (const page of pages) {
    const key = sectionKey(page.path);
    const list = groups.get(key) ?? [];
    list.push(page);
    groups.set(key, list);
  }

  const rank = (key: string) => {
    const i = SECTION_ORDER.indexOf(key);
    return i < 0 ? SECTION_ORDER.length : i;
  };

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

  for (const key of [...groups.keys()].sort((a, b) => rank(a) - rank(b))) {
    out.push(`## ${key === "" ? "Getting started" : (SECTION_TITLES[key] ?? key)}`, "");
    const list = groups
      .get(key)!
      .sort((a, b) => (a.data.title ?? "").localeCompare(b.data.title ?? ""));
    for (const page of list) {
      const desc = page.data.description ? `: ${page.data.description}` : "";
      out.push(`- [${page.data.title}](${origin}${page.url})${desc}`);
    }
    out.push("");
  }

  return new Response(out.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
