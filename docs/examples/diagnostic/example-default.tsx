"use client";

import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticFrame,
  DiagnosticFrames,
  DiagnosticHeader,
  DiagnosticList,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
  Show,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { QUESTS } from "@/example/quests";
import { breaches, RULES_SOURCE } from "@/example/rules";
import { grade } from "@/example/world";

/** Which line of the standing orders each rule is written on — read off the source, not transcribed. */
const RULE_LINE = new Map(
  RULES_SOURCE.split("\n").flatMap((text, index) => {
    const name = /^rule "([^"]+)"/.exec(text)?.[1];
    return name ? ([[name, index + 1]] as [string, number][]) : [];
  })
);

const BREACHES = breaches();
const BREACHED = new Set(BREACHES.map((breach) => breach.quest.id));
const LIVE = QUESTS.filter((quest) => quest.status === "claimed" || quest.status === "afield");

interface Finding {
  key: string;
  variant: "destructive" | "warning" | "info";
  message: string;
  source: string;
  detail: string;
  /** The position the reader is sent to — a real path, and a line where there is one. */
  at: { path: string; line?: number; column?: number; label: string };
  /** The position that explains it, which nobody wrote: inferred, and therefore secondary. */
  from: { path: string; label: string };
}

/**
 * What the badge says. **The variant names a token, not a finding** — nobody wants to read the word
 * "destructive" on a row about a writ — so the word beside the glyph is the caller's, which is the
 * whole reason `DiagnosticSeverity` takes children.
 */
const WORD: Record<Finding["variant"], string> = {
  destructive: "Violation",
  info: "Note",
  warning: "Warning",
};

/**
 * Three checks over one board, worst first — the two standing orders that fire on it, and two
 * facts read straight off the ledger. Six is the number on purpose: a diagnostic that is fine as a
 * single specimen is often unreadable as a list.
 */
const FINDINGS: Finding[] = [
  ...BREACHES.map((breach) => ({
    key: `${breach.quest.id}:${breach.rule}`,
    variant: "destructive" as const,
    message: breach.message,
    source: breach.rule,
    detail: `${breach.quest.title} — ${grade(breach.quest.grade).label}, a party of ${breach.quest.party.length}.`,
    at: {
      path: "standing-orders.rules",
      line: RULE_LINE.get(breach.rule),
      column: 3,
      label: "the rule",
    },
    from: { path: `ledger/${breach.quest.id}/party`, label: "as claimed" },
  })),
  ...LIVE.filter((quest) => quest.dueDayOffset < 0 && !BREACHED.has(quest.id)).map((quest) => ({
    key: `${quest.id}:overdue`,
    variant: "warning" as const,
    message: `A ${grade(quest.grade).label} is ${-quest.dueDayOffset} days past its date.`,
    source: "due dates",
    detail: `${quest.title} — a party of ${quest.party.length}, still afield.`,
    at: { path: `ledger/${quest.id}/due`, label: "the date" },
    from: { path: `ledger/${quest.id}/party`, label: "still out" },
  })),
  ...QUESTS.filter((quest) => quest.status === "open" && quest.grade >= 4)
    .slice(0, 2)
    .map((quest) => ({
      key: `${quest.id}:unsigned`,
      variant: "info" as const,
      message: `A ${grade(quest.grade).label} has stood ${-quest.postedDayOffset} days with nobody signed.`,
      source: "the board",
      detail: `${quest.title} — ${quest.region}.`,
      at: { path: `ledger/${quest.id}`, label: "the contract" },
      from: { path: `ledger/${quest.id}/party`, label: "unsigned" },
    })),
];

export default function Example() {
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <DiagnosticList>
        {FINDINGS.map((finding, i) => (
          // The first row is open at rest, the way `collapsible` and `accordion`'s own examples
          // are. Closed, four of this family's twelve parts — the description, the frames and both
          // frame rows — were never in the DOM, so the page's longest section taught a treatment
          // the preview above it did not draw.
          <Diagnostic defaultOpen={i === 0} key={finding.key} variant={finding.variant}>
            <DiagnosticHeader>
              <DiagnosticSeverity>{WORD[finding.variant]}</DiagnosticSeverity>
              <DiagnosticTitle>{finding.message}</DiagnosticTitle>
              <DiagnosticSource>{finding.source}</DiagnosticSource>
              <DiagnosticActions>
                <DiagnosticTrigger>2 positions</DiagnosticTrigger>
              </DiagnosticActions>
            </DiagnosticHeader>

            <DiagnosticContent>
              <DiagnosticDescription>{finding.detail}</DiagnosticDescription>

              <DiagnosticFrames>
                <DiagnosticFrame
                  column={finding.at.column}
                  label={finding.at.label}
                  line={finding.at.line}
                  onSelect={() =>
                    setOpened(
                      finding.at.line ? `${finding.at.path}:${finding.at.line}` : finding.at.path
                    )
                  }
                  path={finding.at.path}
                />
                <DiagnosticFrame label={finding.from.label} path={finding.from.path} secondary />
              </DiagnosticFrames>
            </DiagnosticContent>
          </Diagnostic>
        ))}
      </DiagnosticList>

      <Show when={opened !== null}>
        <p className="text-muted-foreground text-xs">
          Opened <span className="font-mono">{opened}</span>.
        </p>
      </Show>
    </div>
  );
}
