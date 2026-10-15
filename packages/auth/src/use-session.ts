"use client";

import { useContext } from "react";
import { AuthContext } from "./auth-context";
import { can } from "./can";
import { edgeUrl } from "./edge-url";
import type { Session } from "./types";

/**
 * Who is signed in, where to send them to sign in or out, and the role question asked here.
 *
 * `signInUrl` and `signOutUrl` are links to the edge's pages, for an `<a href>`: the edge signs in
 * and out, and the application only sends the person there. Each comes back to `returnTo` — a path
 * on this origin — or to the edge's default, `/`.
 *
 * `can(role, organization?)` is {@link can} bound to this session, so it asks inside the current
 * tenant unless told which — Clerk's `useAuth().has()`. It decides what to draw, never what to
 * allow.
 */
export function useSession(): {
  readonly session: Session | null;
  readonly signInUrl: (returnTo?: string) => string;
  readonly signOutUrl: (returnTo?: string) => string;
  readonly can: (role: string, organization?: string) => boolean;
} {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error(
      "useSession() was called outside <AuthProvider>. Wrap the application in one, passing the " +
        "session the server read: <AuthProvider session={await auth.session()}>.",
    );
  }
  const { session, prefix } = context;

  return {
    session,
    signInUrl: (returnTo) => edgeUrl(prefix, "sign_in", returnTo),
    signOutUrl: (returnTo) => edgeUrl(prefix, "sign_out", returnTo),
    can: (role, organization) => can(session, role, organization),
  };
}
