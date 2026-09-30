---
"@kanzo-tech/navigation": minor
---

**New package: `@kanzo-tech/navigation`, an unsaved-changes guard with no `history` patch.** One
hook, `useBlocker`, in TanStack Router's shape:

```tsx
import { useBlocker } from "@kanzo-tech/navigation";
import { Link, useRouter } from "@kanzo-tech/navigation/next";

const blocker = useBlocker({ shouldBlockFn: () => true, disabled: !dirty, withResolver: true });
// blocker.status === "blocked" → open your AlertDialog; blocker.proceed() leaves, blocker.reset() stays.
```

The root catches back, forward, plain anchors and `location.assign` through the Navigation API, and
reload and close through `beforeunload`. On the App Router, import `Link` and `useRouter` from
`@kanzo-tech/navigation/next` instead of `next/link` and `next/navigation` (it needs `next >=15.3`),
and forbid the raw imports with `no-restricted-imports` — the rule is on `/docs/navigation-guard/next`.
There is no dialog in the package: compose `AlertDialog` with your own wording. In Safari, a
cancelled Back leaves the browser's history one step ahead; `/docs/navigation-guard` has the whole
coverage table.
