---
"@kanzo-tech/ai": minor
---

**`Assist` takes a `context` of its own.** What the host knows about one field that its label and
description do not say — the values it accepts, its limits, what its neighbours hold — is told to the
model under *Field context*, before the provider's form context. A string, or a function read when the
field asks:

```tsx
<Assist context={() => describeConstraints(field)} onValueChange={setValue} value={value}>
  <Input />
</Assist>
```

`instructions` stays the one-sentence instruction it was; nothing else changes.
