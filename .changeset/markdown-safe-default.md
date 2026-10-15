---
"@kanzo-tech/ai": minor
---

`MessageMarkdown` (and so `Chat`) no longer loads an image a model's markdown names: `![x](https://…)`,
an inline `data:` image and a raw `<img>` all draw nothing, since a remote image is a request the
reader's browser sends wherever the model pointed it. Links still ask before they open, and
`javascript:` links are dropped. If you render markdown you wrote yourself and want images, pass
Streamdown's own `rehypePlugins={Object.values(defaultRehypePlugins)}` (from `streamdown`) to
`MessageMarkdown`.
