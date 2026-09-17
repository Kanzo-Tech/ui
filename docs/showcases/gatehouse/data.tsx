import { CoinsIcon, ScrollTextIcon, StampIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type Quest, questsOf } from "@/example/quests";
import { HALLS, type HallId, ROLES } from "@/example/world";
import { CHARTERED, guildAuth } from "@/lib/guild-auth";

/**
 * The gatehouse's world: one fake `Auth`, five halls, and the board each one posts.
 *
 * The `Auth` is not written here. `@/lib/guild-auth` already builds one — over `claims()`, the real
 * reader, so what this screen draws is what a Keycloak token would actually produce — and every
 * auth page on the site hangs off it. A second fake would be a second fiction to keep in step.
 * What this file adds is the one thing the gatehouse needs and the pages do not: it starts
 * **outside** the gate.
 */

/**
 * Signed out to begin with, because the sign-in screen is half of what this showcase is for.
 *
 * `signIn()` then flips local state and announces, `signOut()` clears it, and the provider above
 * re-reads on both — the whole flow, with no identity provider and no network. That the interface
 * is five members is what makes that possible, and it is the same property that lets one provider
 * serve a BFF and a browser client without anything below knowing which is underneath.
 */
export function gatehouseAuth() {
  return guildAuth(null);
}

/** Every hall the board knows, and whether the session carries a charter in it. */
export const HALL_OPTIONS = HALLS.map((entry) => ({
  ...entry,
  /** Two of the five are `false`, and selecting one is the point — see `useOrganization`. */
  chartered: CHARTERED.some((charter) => charter.id === entry.id),
}));

export interface NavEntry {
  title: string;
  icon: ReactNode;
  /**
   * The role this entry needs *inside the hall being looked at*, if any.
   *
   * It is a field rather than a branch so the nav column stays a `map`: `Gate` reads it and the
   * loop never learns what a warden is.
   */
  role?: string;
}

export const NAV: NavEntry[] = [
  { title: "Board", icon: <ScrollTextIcon /> },
  { title: "Roster", icon: <UsersIcon /> },
  { title: "Ledger", icon: <CoinsIcon /> },
  { title: "Charter", icon: <StampIcon />, role: "warden" },
];

/** The hall's own postings, trimmed to what a screen shows without scrolling. */
export function boardOf(alias: HallId): Quest[] {
  return questsOf(alias).slice(0, 6);
}

/**
 * A role as a reader sees it.
 *
 * Tolerant on purpose: `session.roles` carries the realm roles — a rank, here — and a hall's roles
 * carry a `RoleId`. The two sets are deliberately not merged, so the same badge draws both and
 * neither vocabulary owns the lookup.
 */
export function roleLabel(id: string): string {
  const known = ROLES.find((entry) => entry.id === id);
  return known ? known.label : `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}
