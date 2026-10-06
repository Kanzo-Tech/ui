---
"@kanzo-tech/ai": patch
---

**`Chat` and `ChatSkeleton` fill their parent's height, and land in the same place.** Both are now
one frame: in a flex column or in a block with a height of its own, the skeleton is exactly as tall
as the chat that replaces it, with its empty state and composer in the same place. If you wrapped
`ChatSkeleton` in a `flex flex-col` box only so it would match `Chat`, you can drop the wrapper.

**Behaviour change: `suggestions={[]}` keeps the strip's row.** When suggesting fails, pass an empty
array as before; the strip now stays one pill high and empty, so the empty state above it does not
move. To draw no strip at all, leave `suggestions` out. While `suggesting`, the strip holds exactly
as many skeleton pills as it lacks, never a second row.
