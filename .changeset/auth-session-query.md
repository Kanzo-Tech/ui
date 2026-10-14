---
"@kanzo-tech/auth": minor
---

`useSession` stays current: the session is read again when the tab becomes visible, after a renewal, and when another tab loads, renews or signs out, so a sign-out in one tab signs out the others and a renewed session's roles and `expiresAt` are the ones drawn. A session read within a minute of its expiry is renewed before it is answered. The session is a query on your own TanStack Query client, so it appears in your devtools and goes when you clear the client — clear it on sign-out. **Breaking:** install `@tanstack/react-query` 5 and render one `QueryClientProvider` above `AuthProvider`; without it `AuthProvider` throws TanStack's own *No QueryClient set*. A hand-written `Auth` must read the session afresh on every `getSession()`: `AuthProvider` holds the only copy.
