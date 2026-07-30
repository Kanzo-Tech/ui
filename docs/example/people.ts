// The roster — thirty-five members across the five halls.
//
// Hand-authored, because names are the part of a fixture a reader remembers: "Ravenna Sarkis"
// recurring across the sidebar, a table row and an avatar is what makes ninety-three previews feel
// like one product. The distribution is uneven on purpose — filters and facet counts only prove
// anything against data that is lumpy.

import { type HallId, type RankId, RANKS, type RoleId, isoDay } from "./world";

export interface Member {
  id: string;
  name: string;
  /** How the board addresses them — also the mention token in comments. */
  handle: string;
  hall: HallId;
  role: RoleId;
  rank: RankId;
  /**
   * Why this member is unavailable, when the reason is not simply "out on a contract".
   *
   * Authored, because it is narrative — Fenn went missing, Otto and Dagfinn are hurt. Being *out*
   * is not authored: it is derived from the board by `roster.ts`, because a roster that says
   * "Ready" beside a member the board has afield is the exact contradiction a reader spots first.
   */
  condition?: "resting" | "wounded" | "missing";
  /** Contracts settled, all halls, all time. The sortable numeric column. */
  settled: number;
  /** Day-fee in gold. Small integers, so a number field and a currency cell stay legible. */
  fee: number;
  /** Days before `TODAY`, negative. Rendered through `isoDay`, never through the real clock. */
  joinedDayOffset: number;
}

// `as const satisfies`, not a `readonly Member[]` annotation: the annotation would widen every
// `id` to `string` and `MemberId` with it, so a party listing a member who does not exist would
// typecheck. This way a typo in `quests.ts` is a build error.
export const MEMBERS = [
  // The Amber Hall — the home roster, so it is the fullest and the most varied.
  { id: "ravenna", name: "Ravenna Sarkis", handle: "ravenna", hall: "amber", role: "warden", rank: "gold", settled: 71, fee: 12, joinedDayOffset: -2190 },
  { id: "marrow", name: "Piet Marrow", handle: "marrow", hall: "amber", role: "sapper", rank: "silver", settled: 38, fee: 9, joinedDayOffset: -1460 },
  { id: "bell", name: "Oyelaran Bell", handle: "bell", hall: "amber", role: "cantor", rank: "silver", settled: 44, fee: 11, joinedDayOffset: -1655 },
  { id: "vault", name: "Inés Vault", handle: "vault", hall: "amber", role: "archivist", rank: "iron", condition: "resting", settled: 19, fee: 7, joinedDayOffset: -620 },
  { id: "quill", name: "Tomas Quill", handle: "quill", hall: "amber", role: "scout", rank: "iron", settled: 23, fee: 7, joinedDayOffset: -540 },
  { id: "hesper", name: "Hesper Vane", handle: "hesper", hall: "amber", role: "alchemist", rank: "silver", settled: 40, fee: 10, joinedDayOffset: -1520 },
  { id: "bram", name: "Bram Tallow", handle: "bram", hall: "amber", role: "warden", rank: "iron", settled: 22, fee: 8, joinedDayOffset: -660 },

  // The Order of Salt — the oldest hall, and the one with the highest ranks.
  { id: "grieve", name: "Halla Grieve", handle: "grieve", hall: "salt", role: "warden", rank: "adamant", settled: 118, fee: 18, joinedDayOffset: -4380 },
  { id: "sabin", name: "Sabin Okonkwo", handle: "sabin", hall: "salt", role: "alchemist", rank: "gold", settled: 66, fee: 14, joinedDayOffset: -2555 },
  { id: "miren", name: "Mirén Costa", handle: "miren", hall: "salt", role: "scout", rank: "silver", settled: 41, fee: 9, joinedDayOffset: -1310 },
  { id: "otto", name: "Otto Lindqvist", handle: "otto", hall: "salt", role: "sapper", rank: "copper", condition: "wounded", settled: 6, fee: 5, joinedDayOffset: -210 },
  { id: "yusra", name: "Yusra Halim", handle: "yusra", hall: "salt", role: "cantor", rank: "silver", settled: 47, fee: 11, joinedDayOffset: -1720 },
  { id: "nerea", name: "Nerea Solano", handle: "nerea", hall: "salt", role: "archivist", rank: "silver", settled: 45, fee: 10, joinedDayOffset: -1580 },
  { id: "creel", name: "Tobias Creel", handle: "creel", hall: "salt", role: "scout", rank: "copper", settled: 11, fee: 6, joinedDayOffset: -340 },

  // The Nine — count again.
  { id: "corvin", name: "Corvin Delacroix", handle: "corvin", hall: "nine", role: "archivist", rank: "gold", settled: 58, fee: 13, joinedDayOffset: -2010 },
  { id: "stiles", name: "Baruch Stiles", handle: "stiles", hall: "nine", role: "warden", rank: "silver", settled: 35, fee: 10, joinedDayOffset: -1180 },
  { id: "vrana", name: "Ludmila Vrána", handle: "vrana", hall: "nine", role: "alchemist", rank: "adamant", settled: 103, fee: 17, joinedDayOffset: -3650 },
  { id: "fenn", name: "Fenn Aldabra", handle: "fenn", hall: "nine", role: "scout", rank: "copper", condition: "missing", settled: 4, fee: 5, joinedDayOffset: -150 },
  { id: "kesi", name: "Kesi Adeyemi", handle: "kesi", hall: "nine", role: "cantor", rank: "iron", settled: 21, fee: 8, joinedDayOffset: -700 },
  { id: "ilse", name: "Ilse Danner", handle: "ilse", hall: "nine", role: "sapper", rank: "silver", settled: 37, fee: 10, joinedDayOffset: -1275 },
  { id: "ozren", name: "Ozren Vuk", handle: "ozren", hall: "nine", role: "warden", rank: "iron", settled: 26, fee: 8, joinedDayOffset: -810 },

  // Ash & Company — the newest charter, and it takes the worst work.
  { id: "roe", name: "Dagfinn Roe", handle: "roe", hall: "ash", role: "warden", rank: "gold", condition: "wounded", settled: 63, fee: 13, joinedDayOffset: -1830 },
  { id: "solveig", name: "Solveig Marsh", handle: "solveig", hall: "ash", role: "sapper", rank: "silver", settled: 39, fee: 10, joinedDayOffset: -1240 },
  { id: "rui", name: "Rui Ferreiro", handle: "rui", hall: "ash", role: "alchemist", rank: "iron", settled: 17, fee: 8, joinedDayOffset: -480 },
  { id: "kestrel", name: "Nadia Kestrel", handle: "kestrel", hall: "ash", role: "scout", rank: "silver", settled: 43, fee: 9, joinedDayOffset: -1390 },
  { id: "emrys", name: "Emrys Coldwell", handle: "emrys", hall: "ash", role: "archivist", rank: "copper", condition: "resting", settled: 8, fee: 6, joinedDayOffset: -260 },
  { id: "perpetua", name: "Perpetua Lund", handle: "perpetua", hall: "ash", role: "cantor", rank: "silver", settled: 42, fee: 11, joinedDayOffset: -1435 },
  { id: "faisal", name: "Faisal Amari", handle: "faisal", hall: "ash", role: "sapper", rank: "iron", settled: 20, fee: 8, joinedDayOffset: -590 },

  // The Lanternwood Compact — invited, not yet chartered, which is why it is short a warden.
  { id: "wren", name: "Wren Halloway", handle: "wren", hall: "lanternwood", role: "scout", rank: "adamant", settled: 96, fee: 16, joinedDayOffset: -3285 },
  { id: "ansel", name: "Ansel Thibault", handle: "ansel", hall: "lanternwood", role: "cantor", rank: "gold", settled: 61, fee: 12, joinedDayOffset: -1950 },
  { id: "beatrix", name: "Beatrix Odemba", handle: "beatrix", hall: "lanternwood", role: "warden", rank: "iron", settled: 24, fee: 8, joinedDayOffset: -730 },
  { id: "silas", name: "Silas Aughton", handle: "silas", hall: "lanternwood", role: "sapper", rank: "copper", condition: "resting", settled: 9, fee: 6, joinedDayOffset: -300 },
  { id: "doro", name: "Doro Mikkelsen", handle: "doro", hall: "lanternwood", role: "alchemist", rank: "iron", settled: 18, fee: 8, joinedDayOffset: -505 },
  { id: "agata", name: "Ágata Reyes", handle: "agata", hall: "lanternwood", role: "archivist", rank: "silver", settled: 36, fee: 10, joinedDayOffset: -1225 },
  { id: "lyle", name: "Cuthbert Lyle", handle: "lyle", hall: "lanternwood", role: "scout", rank: "copper", settled: 7, fee: 5, joinedDayOffset: -195 },
] as const satisfies readonly Member[];

export type MemberId = (typeof MEMBERS)[number]["id"];

export function member(id: string): Member {
  const found = MEMBERS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such member: ${id}`);
  return found;
}

export function membersOf(hall: HallId): Member[] {
  return MEMBERS.filter((candidate) => candidate.hall === hall);
}

/**
 * The signed-in viewer, drawn from the roster rather than invented beside it — so "you" appear in
 * the tables like everyone else and the "this row is mine" case actually occurs.
 *
 * The address is on `.example`, reserved by RFC 2606, so it cannot be a real mailbox.
 */
export const VIEWER = {
  ...member("ravenna"),
  email: "ravenna@amberhall.example",
  title: "Quartermaster",
} as const;

/** Two initials, the way `SidebarUser` derives them, for a bare `AvatarFallback`. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** ISO joining date — the world's clock, not the machine's. */
export function joinedOn(candidate: Member): string {
  return isoDay(candidate.joinedDayOffset);
}

/** Rank as a position in the ordered scale, for a progress bar or a slider. */
export function rankIndex(rank: RankId): number {
  return RANKS.findIndex((candidate) => candidate.id === rank);
}
