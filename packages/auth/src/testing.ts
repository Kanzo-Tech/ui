import type { Auth, Session } from "./types";

/**
 * An {@link Auth} for a test or a documentation page, with no protocol behind any of its members.
 *
 * A product writes `bffAuth(…)` in production and never writes this. Make the {@link Session} with
 * `claims()` from `@kanzo-tech/auth/server`, so what a test draws is what a token produces and a
 * hand-written session cannot agree with the pages by construction.
 *
 * ```ts
 * const auth = fakeAuth(claims({ sub: "u-1", organization: { acme: {} } }, { clientId: "board" }));
 * auth.set(null); // signed out; every subscriber hears it
 * ```
 *
 * `signIn` signs in as the session it was given, `signOut` signs out, and `set` replaces the
 * session from outside, as another tab or a renewal would. `fetch` is the host's, defaulting to a
 * 204 for every request.
 */
export interface FakeAuth extends Auth {
  /** Replace the session and tell every subscriber, as a renewal or another tab would. */
  set(session: Session | null): void;
}

export function fakeAuth(
  session: Session | null,
  options: { readonly fetch?: typeof globalThis.fetch } = {},
): FakeAuth {
  let current = session;
  const listeners = new Set<() => void>();
  const set = (next: Session | null) => {
    current = next;
    for (const listener of listeners) listener();
  };

  return {
    fetch: options.fetch ?? (async () => new Response(null, { status: 204 })),
    getSession: async () => current,
    signIn: async () => set(session),
    signOut: async () => set(null),
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    set,
  };
}
