import { defineDocs, defineConfig } from "fumadocs-mdx/config";

// Mirrors Shark UI's setup: MDX under content/docs, frontmatter extended with upstream links
// so a component page can point at the Ark UI docs it wraps.
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig({
  mdxOptions: {
    // Shiki dual-theme, same as Shark: CSS picks --shiki-light / --shiki-dark, so the code
    // blocks follow the theme toggle without re-highlighting.
    rehypeCodeOptions: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    },
  },
});
