"use client";

import { createContext } from "react";
import type { Session } from "./types";

/**
 * The context, in its own module because two files need it and neither should import the other.
 * `createContext` is what makes this file client-only.
 */
export interface AuthContextValue {
  /** The person, as the server read them for this render, or `null`. */
  readonly session: Session | null;
  /** Where the edge's `sign_in` and `sign_out` live. */
  readonly prefix: string;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
