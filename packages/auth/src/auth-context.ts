"use client";

import { createContext } from "react";
import type { Auth, Session } from "./types";

/**
 * The context, in its own module because two files need it and neither should import the other.
 * `createContext` is what makes this file client-only.
 */

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "failed";

export interface AuthContextValue {
  readonly auth: Auth;
  readonly session: Session | null;
  readonly status: AuthStatus;
  /** What `getSession` rejected with, exactly as thrown, while `status` is `"failed"`. */
  readonly error: unknown;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
