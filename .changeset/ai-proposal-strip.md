---
"@kanzo-tech/ai": minor
---

**`Assist`'s candidates and `Chat`'s questions are one strip.** A ✨ leads it, and each pill's
rationale is now in its tooltip and read as its accessible description, in `Chat` too. While
`Assist` asks, the strip shows pills in skeleton instead of a spinner.

**`dataSuggestions` offers what crosses a join first.** It now favours questions across a join the
schema declares, and each rationale names the tables the question connects. Its docs and `suggest()`'s
now use your `complete` alias rather than `chat`.

**Breaking:** `AssistTranslations.thinking` is removed, since nothing says "Thinking…" any more.
Delete it from your translations. A candidate no longer carries a `title`; read its rationale from
the tooltip or the pill's `aria-describedby`.
