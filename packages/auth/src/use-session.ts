"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";

/**
 * Who is signed in, and the two things you can do about it.
 *
 * `status` is the field to branch on, not `session === null`: those are the same answer for
 * "anonymous" and "we have not looked yet", and drawing a sign-in prompt during the second is the
 * flicker every application with a session has shipped at least once. `"failed"` is the session
 * that could not be read, with what was thrown on `error`.
 */
export function useSession(): AuthContextValue & {
  readonly signIn: AuthContextValue["auth"]["signIn"];
  readonly signOut: AuthContextValue["auth"]["signOut"];
} {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error(
      "useSession() was called outside <AuthProvider>. Wrap the application in one, passing the " +
        "auth it should use — browserAuth() for a SPA, bffAuth() where there is a server.",
    );
  }

  return {
    ...context,
    signIn: context.auth.signIn,
    signOut: context.auth.signOut,
  };
}
