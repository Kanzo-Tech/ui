// What a check found, as data: one result, or many results that share a rule. The place a result
// points at is the host's — a focus node and a path, a line of a program — and nothing here reads
// it, so a SHACL report and a compiler's diagnostics are the same two shapes. Not a client module:
// a Server Component may group what it fetched before it renders a row. The argument is
// `/docs/design/findings`.

/** SHACL's three, worst first: `sh:Violation`, `sh:Warning`, `sh:Info`. A compiler's error is a violation. */
export type FindingSeverity = "violation" | "warning" | "info";

/** What raised a finding: an id a tool can be handed back, and a label a reader can. */
export interface FindingRule {
  id: string;
  label: string;
}

/** **One result**, always one: a rule that failed at one place. */
export interface Finding<Place = unknown> {
  severity: FindingSeverity;
  message: string;
  rule: FindingRule;
  place: Place;
  /** What to do about it, when the rule says. */
  help?: string;
}

/**
 * **Many results that share a key** — a rule, and usually a path. `count` is how many there are and
 * `places` where; `sample` is the few a reader opens to see what they look like. `count` is its own
 * field because a host may hold a summary of seventeen thousand and the places of only some.
 */
export interface FindingGroup<Place = unknown> {
  rule: FindingRule;
  severity: FindingSeverity;
  message: string;
  count: number;
  places: Place[];
  sample: Finding<Place>[];
}

/** How many of each severity, and all of them. */
export type FindingTally = Record<FindingSeverity, number> & { total: number };

const RANK: Record<FindingSeverity, number> = { violation: 0, warning: 1, info: 2 };

/**
 * Folds findings that share `keyOf` into one group each: the worst severity among them, the first
 * one's rule and message, every place, and the first `sample` findings. **Worst first, and in the
 * order each key first appeared within a severity** — the host's order (by line, by node) survives,
 * and only the triage order is imposed.
 */
export function groupFindings<Place>(
  findings: readonly Finding<Place>[],
  keyOf: (finding: Finding<Place>) => string,
  sample = 3,
): FindingGroup<Place>[] {
  const groups = new Map<string, FindingGroup<Place>>();
  for (const finding of findings) {
    const key = keyOf(finding);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        rule: finding.rule,
        severity: finding.severity,
        message: finding.message,
        count: 1,
        places: [finding.place],
        sample: sample > 0 ? [finding] : [],
      });
      continue;
    }
    group.count += 1;
    group.places.push(finding.place);
    if (group.sample.length < sample) group.sample.push(finding);
    if (RANK[finding.severity] < RANK[group.severity]) group.severity = finding.severity;
  }
  // `Array.prototype.sort` is stable, so first appearance holds within a severity.
  return [...groups.values()].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** The tally of findings and groups alike: a group counts as its `count`, not as its sample. */
export function tallyFindings(
  items: readonly (Finding<unknown> | FindingGroup<unknown>)[],
): FindingTally {
  const tally: FindingTally = { violation: 0, warning: 0, info: 0, total: 0 };
  for (const item of items) {
    const n = "count" in item ? item.count : 1;
    tally[item.severity] += n;
    tally.total += n;
  }
  return tally;
}

/** The worst severity a tally holds, or `undefined` when it holds nothing. */
export const worstOf = (tally: FindingTally): FindingSeverity | undefined =>
  (["violation", "warning", "info"] as const).find((severity) => tally[severity] > 0);
