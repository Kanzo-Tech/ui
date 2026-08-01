// The roster as a screen shows it: the authored member, plus the availability the board implies.
//
// This module exists because the first version of the world authored `availability` on the member
// and a party on the contract, and the two disagreed within an hour — the generator staffed a
// member marked `missing` onto a contract that had just been signed. Deriving it removes the
// possibility rather than adding a test for it.
//
// It sits between `people.ts` and `quests.ts` (both of which it imports, and neither of which
// imports it), so the derivation cannot become a cycle.

import { type Member, MEMBERS } from "./people";
import { QUESTS, type Quest } from "./quests";
import { type AvailabilityId, AVAILABILITY, type HallId, type RoleId } from "./world";

export interface RosterEntry extends Member {
  availability: AvailabilityId;
  /** The live contract this member is committed to, if any. */
  contract?: Quest;
}

/**
 * An authored condition wins over the board.
 *
 * Dagfinn Roe is wounded *and* afield on the overdue basilisk contract: both are true, and
 * "Wounded" is the one a quartermaster needs to see. The order of precedence is the whole
 * derivation.
 */
function availabilityOf(candidate: Member, contract?: Quest): AvailabilityId {
  if (candidate.condition) return candidate.condition;
  return contract ? "afield" : "ready";
}

function liveContractOf(candidate: Member): Quest | undefined {
  return QUESTS.find(
    (q) =>
      (q.status === "claimed" || q.status === "afield") &&
      q.party.some((id) => id === candidate.id),
  );
}

export const ROSTER: readonly RosterEntry[] = MEMBERS.map((candidate) => {
  const contract = liveContractOf(candidate);
  return {
    ...candidate,
    availability: availabilityOf(candidate, contract),
    ...(contract ? { contract } : {}),
  };
});

export function rosterEntry(id: string): RosterEntry {
  const found = ROSTER.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No such member: ${id}`);
  return found;
}

export function rosterOf(hall: HallId): RosterEntry[] {
  return ROSTER.filter((candidate) => candidate.hall === hall);
}

/** Who could be sent out today — what a "claim this contract" control offers. */
export function availableNow(): RosterEntry[] {
  return ROSTER.filter((candidate) => candidate.availability === "ready");
}

export function withRole(role: RoleId): RosterEntry[] {
  return ROSTER.filter((candidate) => candidate.role === role);
}

/** Head-count per availability, in `AVAILABILITY` order — a facet, a legend, a stat row. */
export function availabilityCounts(): { id: AvailabilityId; label: string; count: number }[] {
  return AVAILABILITY.map((state) => ({
    id: state.id,
    label: state.label,
    count: ROSTER.filter((candidate) => candidate.availability === state.id).length,
  }));
}
