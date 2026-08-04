// The party rules — the code fixture, and the one the editor examples load.
//
// A small language rather than JSON or YAML, because the editor examples need something with
// keywords worth highlighting and diagnostics worth pointing at. It is also genuinely evaluated
// below, so a rule page that claims a contract is in breach can be checked rather than believed.

import { member } from "./people";
import { QUESTS, type Quest } from "./quests";
import { GRADES } from "./world";

/** The source the `CodeEditor` examples open with. */
export const RULES_SOURCE = `# The Amber Hall's standing orders.
# Checked when a party signs, and again when it comes back.

rule "a writ needs a seal" {
  when   grade >= 5
  require party.size >= 4
  require party has role "warden"
  else   "A writ may not be signed by fewer than four, one of them a warden."
}

rule "no ward left unlit" {
  when   grade >= 4
  require party has role "cantor"
  else   "Nothing above a Hazard goes out without a cantor."
}

rule "the second attempt" {
  when   tagged "second-attempt"
  require party has rank >= "silver"
  else   "A re-posting is not the place to blood a copper."
}

rule "children present" {
  when   tagged "children-present"
  forbid tagged "no-open-flame"
  else   "Do not bring fire where the children are."
}
`;

export interface Breach {
  quest: Quest;
  rule: string;
  message: string;
}

const RANK_ORDER = ["copper", "iron", "silver", "gold", "adamant"];

/**
 * The four rules above, applied.
 *
 * Hand-written rather than parsed from the source: an interpreter for the toy syntax would be a
 * second thing to maintain and nothing in the docs would be better for it. What matters is that
 * these are the same four rules, so the editor is not showing decoration.
 */
export function breaches(): Breach[] {
  const found: Breach[] = [];
  const live = QUESTS.filter((q) => q.status === "claimed" || q.status === "afield");

  for (const quest of live) {
    const roles = quest.party.map((id) => member(id).role);
    const ranks = quest.party.map((id) => RANK_ORDER.indexOf(member(id).rank));

    if (quest.grade >= 5 && (quest.party.length < 4 || !roles.includes("warden"))) {
      found.push({
        quest,
        rule: "a writ needs a seal",
        message: "A writ may not be signed by fewer than four, one of them a warden.",
      });
    }
    if (quest.grade >= 4 && !roles.includes("cantor")) {
      found.push({
        quest,
        rule: "no ward left unlit",
        message: "Nothing above a Hazard goes out without a cantor.",
      });
    }
    if (quest.tags.includes("second-attempt") && Math.min(...ranks) < RANK_ORDER.indexOf("silver")) {
      found.push({
        quest,
        rule: "the second attempt",
        message: "A re-posting is not the place to blood a copper.",
      });
    }
    if (quest.tags.includes("children-present") && quest.tags.includes("no-open-flame")) {
      found.push({
        quest,
        rule: "children present",
        message: "Do not bring fire where the children are.",
      });
    }
  }

  return found;
}

/** The grade a rule's `when` clause refers to, spelled out — for a legend beside the editor. */
export const GRADE_NAMES = GRADES.map((grade) => `${grade.value} — ${grade.label}`);
