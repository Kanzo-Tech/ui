"use client";

import {
  Button,
  type DescribePlace,
  type Finding,
  FindingsActions,
  FindingsBadge,
  FindingsContent,
  FindingsGroup,
  FindingsHeader,
  FindingsItem,
  FindingsList,
  FindingsRoot,
  FindingsSource,
  groupFindings,
  PopoverDescription,
  Show,
  tallyFindings,
} from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { overdueQuests, type Quest } from "@/example/quests";
import { breaches } from "@/example/rules";
import { grade } from "@/example/world";

/** The place is ours: a quest and the field the order looked at. The library never reads it. */
interface Place {
  quest: Quest;
  field: string;
}

/** Every result, one each — the shape a validator reports in. */
const FINDINGS: Finding<Place>[] = [
  ...breaches().map((breach) => ({
    severity: "violation" as const,
    message: breach.message,
    rule: { id: breach.rule, label: breach.rule },
    place: { quest: breach.quest, field: "party" },
  })),
  ...overdueQuests().map((quest) => ({
    severity: "warning" as const,
    message: "A posting is past its date and the party is still afield.",
    rule: { id: "due-dates", label: "due dates" },
    place: { quest, field: "due" },
    help: "Send a runner, or mark the party lost.",
  })),
];

const plural = new Intl.PluralRules("en");
const counted = (n: number, word: string) => `${n} ${word}${plural.select(n) === "one" ? "" : "s"}`;

export default function Example() {
  const [shown, setShown] = useState<string | null>(null);

  const describe: DescribePlace<Place> = (place) => ({
    where: `${place.field} · ${place.quest.id}`,
    detail: `${place.quest.title} — ${grade(place.quest.grade).label}, a party of ${place.quest.party.length}.`,
  });

  // Many results share a rule and a field; a group is one item however many there are.
  const groups = useMemo(
    () => groupFindings(FINDINGS, (finding) => `${finding.rule.id}|${finding.place.field}`),
    [],
  );
  const tally = tallyFindings(groups);

  return (
    <div className="flex flex-col items-center gap-3">
      <FindingsRoot tally={tally}>
        <FindingsBadge size="lg">
          {(t) =>
            !t
              ? "Not checked"
              : t.total === 0
                ? "In order"
                : [t.violation && counted(t.violation, "breach"), t.warning && counted(t.warning, "warning")]
                    .filter(Boolean)
                    .join(" · ")}
        </FindingsBadge>
        <FindingsContent>
          <FindingsHeader>
            <FindingsSource>standing-orders</FindingsSource>
            <FindingsActions>
              <Button size="sm" variant="outline">
                Change…
              </Button>
            </FindingsActions>
            <PopoverDescription>Every posting on the board, checked.</PopoverDescription>
          </FindingsHeader>
          <FindingsList empty={<p className="text-muted-foreground text-sm">Nothing to report.</p>}>
            <FindingsGroup tally={tallyFindings(groups.filter((g) => g.count > 1))} title="Shared by many">
              {groups
                .filter((group) => group.count > 1)
                .map((group) => (
                  <FindingsItem
                    action={{ label: `Show ${group.count}`, run: () => setShown(group.rule.label) }}
                    describe={describe}
                    finding={group}
                    key={group.rule.id}
                  />
                ))}
            </FindingsGroup>
            <FindingsGroup tally={tallyFindings(groups.filter((g) => g.count === 1))} title="One of a kind">
              {groups
                .filter((group) => group.count === 1)
                .map((group) => {
                  const finding = group.sample[0]!;
                  return (
                    <FindingsItem
                      action={{ label: "Show", run: () => setShown(finding.place.quest.id) }}
                      describe={describe}
                      finding={finding}
                      key={group.rule.id}
                    />
                  );
                })}
            </FindingsGroup>
          </FindingsList>
        </FindingsContent>
      </FindingsRoot>

      <Show when={shown !== null}>
        <p className="text-muted-foreground text-xs">
          Showing <span className="font-mono">{shown}</span>.
        </p>
      </Show>
    </div>
  );
}
