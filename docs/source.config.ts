import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

// Mirrors Shark UI's setup: MDX under content/docs, frontmatter extended with upstream links
// so a component page can point at the Ark UI docs it wraps. The extension is not decoration —
// fumadocs' own page schema strips unknown keys, so without it `links` never reaches `page.data`
// and the page renderer has nothing to show. `app/docs/[[...slug]]/page.tsx` renders the row.
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({
      links: z.object({ doc: z.url().optional() }).optional(),
    }),
  },
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
