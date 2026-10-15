"use client";

import { useMemo } from "react";
import { AuthContext } from "./auth-context";
import { DEFAULT_PREFIX } from "./edge-url";
import type { Session } from "./types";

/**
 * Hands the person to every client component below it. One per application, at the root, in the
 * server layout that read them:
 *
 * ```tsx
 * <AuthProvider session={await auth.session()}>{children}</AuthProvider>
 * ```
 *
 * **The browser reads nothing.** The session is the server's reading of the access token the edge
 * forwarded, made once per request and passed down as a prop, so there is no endpoint to ask, no
 * cache to keep fresh and no renewal to coordinate between tabs: the edge renews, and a page the
 * server renders next reads the renewed token. What the browser knows is for drawing and never for
 * deciding, which is why a copy as old as the page is enough.
 *
 * `prefix` is where the edge's sign-in and sign-out live, the proxy's `OAUTH2_PROXY_PROXY_PREFIX`.
 */
export function AuthProvider({
  session,
  prefix = DEFAULT_PREFIX,
  children,
}: {
  readonly session: Session | null;
  readonly prefix?: string;
  readonly children?: React.ReactNode;
}) {
  const value = useMemo(() => ({ session, prefix }), [session, prefix]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
