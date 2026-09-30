---
"@kanzo-tech/ai": minor
---

**`ConversationEmpty` is removed; a conversation's zero state is `@kanzo-tech/ui`'s `Empty` parts.**
It was a centred column with a measure, which is what `EmptyRoot` and `EmptyHeader` already are.
Replace it inside `ConversationContent`:

```tsx
// before
<ConversationEmpty>
  <SparklesIcon />
  Ask about your data.
</ConversationEmpty>

// after — EmptyRoot, EmptyHeader, EmptyIndicator, EmptyDescription from "@kanzo-tech/ui"
<EmptyRoot>
  <EmptyHeader>
    <EmptyIndicator>
      <SparklesIcon />
    </EmptyIndicator>
    <EmptyDescription>Ask about your data.</EmptyDescription>
  </EmptyHeader>
</EmptyRoot>
```

A selector on `[data-slot=conversation-empty]` becomes `[data-slot=empty]`.
