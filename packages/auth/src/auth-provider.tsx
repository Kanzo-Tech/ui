"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthContext, type AuthStatus } from "./auth-context";
import type { Auth, Session } from "./types";

/**
 * Holds the session and keeps it current. One per application, at the root.
 *
 * It does not know which pattern is underneath it — `bffAuth` or `browserAuth` both satisfy `Auth`
 * — which is the whole reason the hooks below it can be written once.
 */
export function AuthProvider({
  auth,
  children,
}: {
  readonly auth: Auth;
  readonly children?: React.ReactNode;
}) {
  const [state, setState] = useState<{ session: Session | null; status: AuthStatus; error: unknown }>({
    session: null,
    status: "loading",
    error: undefined,
  });

  useEffect(() => {
    // `live` rather than an AbortController: `getSession` may be a cache read with no request to
    // abort, and what must not happen is a setState after unmount — a resolved promise from the
    // provider that was just torn down, overwriting the one that replaced it.
    let live = true;

    const read = () => {
      void auth
        .getSession()
        .then((session) => {
          if (!live) return;
          setState({ session, status: session ? "authenticated" : "anonymous", error: undefined });
        })
        .catch((error: unknown) => {
          // Not "anonymous": that sends the person to sign in over an outage that will still be
          // there when they get back. Not "loading" either: a spinner nobody can escape.
          if (live) setState({ session: null, status: "failed", error });
        });
    };

    const unsubscribe = auth.subscribe(read);
    read();

    return () => {
      live = false;
      unsubscribe();
    };
  }, [auth]);

  const value = useMemo(
    () => ({ auth, session: state.session, status: state.status, error: state.error }),
    [auth, state.session, state.status, state.error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
