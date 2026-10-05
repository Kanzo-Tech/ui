"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { can } from "./can";

/**
 * Who is signed in, the two things you can do about it, and the role question asked here.
 *
 * `status` is the field to branch on, not `session === null`: those are the same answer for
 * "anonymous" and "we have not looked yet", and drawing a sign-in prompt during the second is the
 * flicker every application with a session has shipped at least once. `"failed"` is the session
 * that could not be read, with what was thrown on `error`.
 *
 * `can(role, organization?)` is {@link can} bound to this session, so it asks inside the current
 * tenant unless told which — Clerk's `useAuth().has()`. It decides what to draw, never what to
 * allow.
 */
export function useSession(): AuthContextValue & {
  readonly signIn: AuthContextValue["auth"]["signIn"];
  readonly signOut: AuthContextValue["auth"]["signOut"];
  readonly can: (role: string, organization?: string) => boolean;
} {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error(
      "useSession() was called outside <AuthProvider>. Wrap the application in one, passing the " +
        "auth it should use — bffAuth() for a product whose server runs kanzoAuth.",
    );
  }

  return {
    ...context,
    signIn: context.auth.signIn,
    signOut: context.auth.signOut,
    can: (role, organization) => can(context.session, role, organization),
  };
}
