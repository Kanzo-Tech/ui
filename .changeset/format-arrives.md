---
"@kanzo-tech/ui": minor
---

**`FormatByte`, `FormatNumber` and `FormatRelativeTime` are on the root barrel.**

Ark's formatters, re-exported as they are, so a file size, a count or a "3 days ago" no longer needs
an `Intl` wrapper of your own or a direct `@ark-ui/react` dependency:

```tsx
import { FormatByte, FormatNumber, FormatRelativeTime } from "@kanzo-tech/ui";

<FormatByte value={file.size} />               // 1.45 MB
<FormatNumber style="percent" value={0.94} />  // 94%
<FormatRelativeTime value={job.createdAt} />   // 3 days ago
```

Each renders a bare string in the nearest `LocaleProvider`'s locale (`en-US` without one).
`FormatByte` is decimal by default; pass `unitSystem="binary"` for 1024-based sizes. Nothing
existing changes.
