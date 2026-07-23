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

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pages = source.getPages();

  const groups = new Map<string, typeof pages>();
  for (const page of pages) {
    const key = page.slugs.length > 1 ? page.slugs[0] : "";
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
