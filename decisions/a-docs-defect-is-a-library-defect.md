# A defect visible in `docs/` is a library defect until proven otherwise

- **Status** live — 2026-07-25
- **Decided** Fix it at the source. A containment rule in the consumer is a fix for one consumer.
- **Because** the library's stylesheet shipped the typography plugin under `.prose`, whose
  generated selectors outrank Preflight, so every consumer that happens to use that class name —
  fumadocs does, and it is a common choice — had its anchors, headings, lists and tables repainted
  by a design system it had only asked for a Button. The first fix was a containment rule in the
  docs app; the same bug came back, and the real fix was renaming the plugin's class in
  `styles.css`.
- **Reversed by** a defect that is genuinely the docs app's own — its MDX pipeline, its routing,
  its Shiki rendering. The test: would a consumer who never opens our docs hit it?
- **Held by** `packages/ui/src/styles.css`, the `@plugin "@tailwindcss/typography"` block and the
  comment above it

The standing corollary: `docs/` consumes `dist/`, not `src/`. A rename typechecks clean while the
docs build fails, and a fix in `src/` does not reach the docs app until the package is rebuilt.
