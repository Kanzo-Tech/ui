# @kanzo-tech/navigation

An unsaved-changes guard: one hook, `useBlocker`, in TanStack Router's shape, over the Navigation
API and `beforeunload` — and a `/next` door for the two App Router navigations the browser cannot
see in time.

```sh
pnpm add @kanzo-tech/navigation
```

```tsx
import { useBlocker } from "@kanzo-tech/navigation";
import { Link, useRouter } from "@kanzo-tech/navigation/next";

const blocker = useBlocker({ shouldBlockFn: () => true, disabled: !dirty, withResolver: true });
// blocker.status === "blocked" → show your AlertDialog; blocker.proceed() leaves, blocker.reset() stays.
```

## What it is not

**There is no dialog and no copy.** `status`, `proceed` and `reset` drive the product's own
`AlertDialog`, in the product's own words.

**Nothing is patched.** No `history.pushState`, no router internals, no document-level click
capture. Every navigation is either cancelled through a public API or documented as not covered —
the table is at <https://kanzo-tech.github.io/ui/docs/navigation-guard>.

## Why a package, and not `@kanzo-tech/ui`

`/docs/philosophy` puts *any router integration* in the products, and nothing here draws. It
depends on nothing of `ui`'s.

## Close the door behind you

A raw `next/link` or `useRouter` from `next/navigation` walks past the guard. Forbid both:

```js
"no-restricted-imports": ["error", {
  paths: [
    { name: "next/link", message: "Use Link from @kanzo-tech/navigation/next." },
    { name: "next/navigation", importNames: ["useRouter"], message: "Use useRouter from @kanzo-tech/navigation/next." },
  ],
}],
```
