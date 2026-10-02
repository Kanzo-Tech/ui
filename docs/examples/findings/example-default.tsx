"use client";

import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticHeader,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
  type Finding,
  FindingsContent,
  FindingsGoTo,
  FindingsGroup,
  FindingsRoot,
  FindingsTrigger,
  Show,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { overdueQuests } from "@/example/quests";
import { breaches } from "@/example/rules";
import { grade } from "@/example/world";

interface Breach extends Finding {
  message: string;
  rule: string;
  detail: string;
  at: string;
}

const FINDINGS: Breach[] = [
  ...breaches().map((breach) => ({
    id: `${breach.quest.id}:${breach.rule}`,
    variant: "destructive" as const,
    message: breach.message,
    rule: breach.rule,
    detail: `${breach.quest.title} — ${grade(breach.quest.grade).label}, a party of ${breach.quest.party.length}.`,
    at: `ledger/${breach.quest.id}/party`,
  })),
  ...overdueQuests()
    .slice(0, 2)
    .map((quest) => ({
      id: `${quest.id}:overdue`,
      variant: "warning" as const,
      message: `A ${grade(quest.grade).label} is past its date.`,
      rule: "due dates",
      detail: `${quest.title} — a party of ${quest.party.length}, still afield.`,
      at: `ledger/${quest.id}/due`,
    })),
];

const WORD = { destructive: "Breach", warning: "Warning", info: "Note" };

/**
 * One row, written once and handed to every group: a `Diagnostic`, so it is one line until it is
 * opened, and opening it says the rest.
 */
const row = (finding: Breach) => (
  <Diagnostic variant={finding.variant}>
    <DiagnosticHeader>
      <DiagnosticSeverity>{WORD[finding.variant]}</DiagnosticSeverity>
      <DiagnosticTitle>{finding.message}</DiagnosticTitle>
      <DiagnosticActions>
        <FindingsGoTo>Go to</FindingsGoTo>
        <DiagnosticTrigger aria-label={`Details of ${finding.message}`} />
      </DiagnosticActions>
    </DiagnosticHeader>
    <DiagnosticContent>
      <DiagnosticDescription>{finding.detail}</DiagnosticDescription>
      <DiagnosticSource>{finding.rule}</DiagnosticSource>
    </DiagnosticContent>
  </Diagnostic>
);

export default function Example() {
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <FindingsRoot findings={FINDINGS} onSelect={(finding) => setOpened(finding.at)}>
        <FindingsTrigger size="lg">
          {({ destructive, warning, info }) =>
            destructive
              ? `${destructive} breaches`
              : warning
                ? `${warning} warnings`
                : info
                  ? `${info} notes`
                  : "In order"}
        </FindingsTrigger>
        <FindingsContent description="What the standing orders found on the board." title="The board">
          <FindingsGroup title="Breaches" variant="destructive">
            {row}
          </FindingsGroup>
          <FindingsGroup title="Warnings" variant="warning">
            {row}
          </FindingsGroup>
          <FindingsGroup title="Notes" variant="info">
            {row}
          </FindingsGroup>
        </FindingsContent>
      </FindingsRoot>

      <Show when={opened !== null}>
        <p className="text-muted-foreground text-xs">
          Opened <span className="font-mono">{opened}</span>.
        </p>
      </Show>
    </div>
  );
}
