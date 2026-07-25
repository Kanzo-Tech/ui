---
"@kanzo-tech/ui": patch
---

**The stylesheet no longer repaints anybody else's `.prose`.**

`styles.css` bundles `@tailwindcss/typography` for the `Prose` component, and the plugin emits
unscoped descendant rules — `.prose :where(a)`, `:where(h1)`, `:where(table)` and dozens more — at
a specificity that beats Preflight. So any consumer that happens to use the class name `prose` had
its anchors, headings, lists and tables restyled by a design system it only asked for a `Button`.

That is not hypothetical: fumadocs names its content wrapper `.prose`, so **every page of our own
docs site** rendered its headings as blue underlined links and grew underlines on every Card title
and description. Fumadocs writes its own rule defensively as `.prose :where(a:not([data-card]))`,
deliberately excluding the anchors it uses as structure; the plugin excludes nothing and took the
gap.

The plugin is now configured with `className: kanzo-prose`, so our typography claims a name of its
own and `Prose` applies it. No API change — `<Prose>` is unchanged — but a consumer who was
relying on `class="prose"` picking up our styling should use the component (or `kanzo-prose`).
