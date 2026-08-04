import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  Badge,
  Show,
  Status,
  Swatch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { archiveOf, archiveScale } from "@/example/archive";
import { initialsOf, member } from "@/example/people";
import { dueOn, QUESTS } from "@/example/quests";
import { ROSTER } from "@/example/roster";
import { BEASTS, GRADES, HALLS, QUEST_STATUSES, ROLES, hall } from "@/example/world";

// The world, drawn — the tables the `/docs/the-guild` page is made of.
//
// These are documentation furniture rather than examples: nobody copies a table of the fictional
// halls into their app. They live in `components/` for that reason, beside `ComponentsList`, and
// they are registered in the MDX map so the page can call them without an import.

const cellNumeric = "text-right tabular-nums";

export const HallsTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Hall</TableHead>
        <TableHead>Seat</TableHead>
        <TableHead>Standing</TableHead>
        <TableHead>Heraldry</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {HALLS.map((entry) => (
        <TableRow key={entry.id}>
          <TableCell className="font-medium">
            {entry.name}
            <span className="block text-muted-foreground text-xs">{entry.motto}</span>
          </TableCell>
          <TableCell>{entry.seat}</TableCell>
          <TableCell>
            <Badge variant={entry.standing === "Chartered" ? "default" : "secondary"}>
              {entry.standing}
            </Badge>
          </TableCell>
          <TableCell>
            <span className="flex items-center gap-2">
              {/* A swatch never carries the meaning alone, so the seed it depicts is named beside it. */}
              <Swatch color={entry.heraldry.brand} />
              <code className="text-xs">{entry.heraldry.brand}</code>
              <Swatch color={entry.heraldry.base} />
              <code className="text-xs">{entry.heraldry.base}</code>
            </span>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const StatusesTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>State</TableHead>
        <TableHead>On the board</TableHead>
        <TableHead className={cellNumeric}>Contracts</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {QUEST_STATUSES.map((state) => (
        <TableRow key={state.id}>
          <TableCell>
            <Badge variant={state.tone}>{state.label}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">{state.description}</TableCell>
          <TableCell className={cellNumeric}>
            {QUESTS.filter((quest) => quest.status === state.id).length}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const RolesTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Role</TableHead>
        <TableHead>Duty</TableHead>
        <TableHead className={cellNumeric}>On the roster</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {ROLES.map((entry) => (
        <TableRow key={entry.id}>
          <TableCell className="font-medium">{entry.label}</TableCell>
          <TableCell className="text-muted-foreground">{entry.duty}</TableCell>
          <TableCell className={cellNumeric}>
            {ROSTER.filter((member) => member.role === entry.id).length}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const GradesTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-16">Grade</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>What it means</TableHead>
        <TableHead className={cellNumeric}>Median reward</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {GRADES.map((grade) => {
        const rewards = QUESTS.filter((quest) => quest.grade === grade.value)
          .map((quest) => quest.reward)
          .sort((a, b) => a - b);
        return (
          <TableRow key={grade.value}>
            <TableCell className="tabular-nums">{grade.value}</TableCell>
            <TableCell className="font-medium">{grade.label}</TableCell>
            <TableCell className="text-muted-foreground">{grade.note}</TableCell>
            <TableCell className={cellNumeric}>
              {rewards[Math.floor(rewards.length / 2)]} gold
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

export const BestiaryTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Beast</TableHead>
        <TableHead>Where it turns up</TableHead>
        <TableHead className={cellNumeric}>Contracts</TableHead>
        <TableHead className={cellNumeric}>Sightings</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {BEASTS.map((entry) => {
        const contracts = QUESTS.filter((quest) => quest.beast === entry.id);
        return (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">{entry.label}</TableCell>
            <TableCell className="text-muted-foreground">{entry.habit}</TableCell>
            <TableCell className={cellNumeric}>{contracts.length}</TableCell>
            <TableCell className={cellNumeric}>
              {contracts.reduce((total, quest) => total + quest.sightings, 0)}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

/** The whole roster, with the availability the board implies rather than an authored one. */
export const RosterTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Member</TableHead>
        <TableHead>Hall</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Rank</TableHead>
        <TableHead>Availability</TableHead>
        <TableHead className={cellNumeric}>Settled</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {ROSTER.map((entry) => (
        <TableRow key={entry.id}>
          <TableCell>
            <span className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>{initialsOf(entry.name)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{entry.name}</span>
              <span className="text-muted-foreground">@{entry.handle}</span>
            </span>
          </TableCell>
          <TableCell>{hall(entry.hall).short}</TableCell>
          <TableCell className="capitalize">{entry.role}</TableCell>
          <TableCell className="capitalize">{entry.rank}</TableCell>
          <TableCell className="whitespace-nowrap">
            <span className="flex items-center gap-2 capitalize">
              <Status variant={availabilityTone(entry.availability)} />
              {entry.availability}
              {/* A deref guard, so it stays a conditional rather than `Show` — whose children are
                  an eager prop and would evaluate `entry.contract.id` on the members who have none. */}
              {entry.contract ? (
                <span className="text-muted-foreground text-xs">on {entry.contract.id}</span>
              ) : null}
            </span>
          </TableCell>
          <TableCell className={cellNumeric}>{entry.settled}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

function availabilityTone(availability: string) {
  if (availability === "ready") return "success";
  if (availability === "afield") return "info";
  if (availability === "wounded") return "warning";
  if (availability === "missing") return "destructive";
  return "default";
}

/** The board itself. Every row is a row some other page also renders. */
export const BoardTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Contract</TableHead>
        <TableHead>Region</TableHead>
        <TableHead className={cellNumeric}>Grade</TableHead>
        <TableHead>State</TableHead>
        <TableHead>Party</TableHead>
        <TableHead className={cellNumeric}>Reward</TableHead>
        <TableHead>Due</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {QUESTS.map((quest) => {
        const state = QUEST_STATUSES.find((entry) => entry.id === quest.status);
        return (
          <TableRow key={quest.id}>
            {/* Titles are long by design, and `TableCell` is `whitespace-nowrap`, so left alone the
                widest one sets the table's width and pushes the due date out of the article. This is
                the column that gives, because it is the one that can. */}
            <TableCell className="max-w-64 whitespace-normal">
              <span className="block font-medium">{quest.title}</span>
              <span className="text-muted-foreground text-xs">
                {quest.id} · {hall(quest.hall).short}
              </span>
            </TableCell>
            <TableCell>{quest.region}</TableCell>
            <TableCell className={cellNumeric}>{quest.grade}</TableCell>
            <TableCell>
              <Badge variant={state?.tone}>{state?.label}</Badge>
            </TableCell>
            <TableCell>
              {/* Names, not the raw ids: the id column was the widest and least informative on the
                  table, and an avatar group is two components in the world agreeing about one row. */}
              <Show fallback={<span className="text-muted-foreground">—</span>} when={quest.party.length > 0}>
                <AvatarGroup>
                  {quest.party.slice(0, 3).map((id) => (
                    <Avatar key={id}>
                      <AvatarFallback>{initialsOf(member(id).name)}</AvatarFallback>
                    </Avatar>
                  ))}
                  <Show when={quest.party.length > 3}>
                    <AvatarGroupCount>+{quest.party.length - 3}</AvatarGroupCount>
                  </Show>
                </AvatarGroup>
              </Show>
            </TableCell>
            <TableCell className={cellNumeric}>{quest.reward}</TableCell>
            <TableCell
              className={
                quest.status === "afield" && quest.dueDayOffset < 0
                  ? "text-destructive tabular-nums"
                  : "text-muted-foreground tabular-nums"
              }
            >
              {dueOn(quest)}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

/**
 * The archive's headline numbers, computed rather than quoted.
 *
 * Every figure here appears in prose on the page beside it. Prose cannot count, so if these were
 * typed they would be the first thing in the world to go stale.
 */
export const ArchiveFacts = () => {
  const scale = archiveScale();
  const busiest = [...ROSTER].sort((a, b) => b.settled - a.settled).slice(0, 3);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>The archive holds</TableHead>
          <TableHead className={cellNumeric}>Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Closed contracts</TableCell>
          <TableCell className={cellNumeric}>{scale.contracts}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Field reports filed against them</TableCell>
          <TableCell className={cellNumeric}>{scale.reports}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Nodes, once members, beasts, regions and tags join them</TableCell>
          <TableCell className={cellNumeric}>{scale.nodes}</TableCell>
        </TableRow>
        {busiest.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground">
              …of which {entry.name} closed
            </TableCell>
            <TableCell className={cellNumeric}>{archiveOf(entry.id).length}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
