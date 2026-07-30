import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

// Component pages carry `links.doc` — the Ark UI page the component wraps. Extending the page
// schema is what puts it on `page.data`; without this the frontmatter is parsed and dropped.
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
    // ```npm code blocks fan out into npm/pnpm/yarn/bun tabs: remarkNpm ships in the default
    // preset, so there is nothing to add here. Reordering the managers is the only knob
    // (`remarkNpmOptions`) and it costs us our own npm-to-x converters, so we take the default.
  },
});
