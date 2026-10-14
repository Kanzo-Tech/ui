"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AuthContext, type AuthStatus } from "./auth-context";
import type { Auth } from "./types";

/**
 * Which `Auth` a read was made through, as a key can say it: a key is hashed as JSON, and two
 * providers on one client — a page and a test double, two docs examples — must not share a session.
 */
const auths = new WeakMap<Auth, number>();
let authCount = 0;
const authKey = (auth: Auth) => {
  let id = auths.get(auth);
  if (id === undefined) auths.set(auth, (id = ++authCount));
  return id;
};

/**
 * Holds the session and keeps it current. One per application, at the root, below the host's
 * `QueryClientProvider`.
 *
 * The session is a TanStack Query query on the host's client (`/docs/design/reads`), and that
 * query's cache is the session's one copy: it is read again when the tab becomes visible, and when
 * `auth` announces a change — a renewal here, or another tab that loaded, renewed or signed out. It
 * never retries, because a retry is a second wait on one failure, and a failed read is `"failed"`
 * with the thrown value, not a signed-out person. Without a `QueryClientProvider` above it, it
 * throws TanStack's own *No QueryClient set*.
 *
 * It does not know what is underneath it — `bffAuth`, or a test's or a host's own `Auth` — which is
 * the whole reason the hooks below it can be written once.
 */
export function AuthProvider({
  auth,
  children,
}: {
  readonly auth: Auth;
  readonly children?: React.ReactNode;
}) {
  const read = useQuery({
    // The keys are the library's, not an API: the session, and the `Auth` it was read through.
    queryKey: ["@kanzo-tech/auth", "session", authKey(auth)],
    queryFn: () => auth.getSession(),
    retry: false,
    // Stale at once, so a tab that becomes visible reads again — `refetchOnWindowFocus`, which is
    // TanStack's visibility, set here rather than left to the host's defaults.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const { refetch } = read;

  useEffect(() => auth.subscribe(() => void refetch()), [auth, refetch]);

  const session = read.isError ? null : (read.data ?? null);
  const status: AuthStatus = read.isError
    ? "failed"
    : read.isPending
      ? "loading"
      : session
        ? "authenticated"
        : "anonymous";
  const error: unknown = read.isError ? read.error : undefined;

  const value = useMemo(() => ({ auth, session, status, error }), [auth, session, status, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
