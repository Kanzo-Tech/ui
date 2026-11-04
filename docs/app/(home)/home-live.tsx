"use client";

import type { Appearance } from "@kanzo-tech/theme";
import {
  Badge,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  SegmentGroup,
  StatDelta,
  StatLabel,
  StatRoot,
  StatTrend,
  StatValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { PlusIcon, SearchIcon } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { boardValue, openQuests, overdueQuests, postedByMonth, questsOf } from "@/example/quests";
import { hall, HOME_HALL, questStatus } from "@/example/world";
import { FAMILIES } from "./families";
import styles from "./home.module.css";

const FamilyContext = createContext<{ family: string; setFamily: (next: string) => void } | null>(
  null,
);

function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily outside <FamilyScope>");
  return ctx;
}

/** The one piece of state the page has: which family the screen, and its source, are painted in. */
export function FamilyScope({ children }: { children: ReactNode }) {
  const [family, setFamily] = useState(FAMILIES[0]?.family ?? "kanzo");
  return <FamilyContext.Provider value={{ family, setFamily }}>{children}</FamilyContext.Provider>;
}

export function FamilySwitch({ className }: { className?: string }) {
  const { family, setFamily } = useFamily();
  return (
    <SegmentGroup
      aria-label="Theme family for the screen below"
      className={className}
      onValueChange={(details) => {
        if (details.value) setFamily(details.value);
      }}
      options={FAMILIES.map((f) => ({ value: f.family, label: f.name }))}
      value={family}
      variant="solid"
    />
  );
}

/** The name of the theme file painting the screen on one side: `nord.css`, `nord-dark.css`. */
export function ThemeFileName({ side }: { side: Appearance }) {
  const { family } = useFamily();
  const entry = FAMILIES.find((f) => f.family === family)?.[side];
  return <>{entry?.value}.css</>;
}

/**
 * Both sides are rendered and the page's `.dark` picks one, because the server render does not know
 * the reader's side. Each copy is a region exactly as `/docs/themes#theming-a-region` writes it.
 */
export function LiveScreen() {
  const { family } = useFamily();
  const entry = FAMILIES.find((f) => f.family === family);
  return (
    <>
      {(["light", "dark"] as const).map((side) => (
        <div className={side === "light" ? "dark:hidden" : "hidden dark:block"} key={side}>
          <div
            className={`${side} ${styles.reskin} overflow-hidden rounded-box border border-border bg-background text-foreground`}
            data-theme={entry?.[side]?.value}
            data-ui
            key={family}
            style={{ colorScheme: side }}
          >
            <Board />
          </div>
        </div>
      ))}
    </>
  );
}

/** Both files of the family, the page's own side first. */
export function ThemeSource({ sources }: { sources: Record<string, ReactNode> }) {
  const { family } = useFamily();
  const entry = FAMILIES.find((f) => f.family === family);
  return (
    <div className="flex flex-1 flex-col gap-4 dark:flex-col-reverse" data-ui>
      {(["light", "dark"] as const).map((side) => (
        <div className="flex flex-1 flex-col" key={side}>
          {sources[entry?.[side]?.value ?? ""]}
        </div>
      ))}
    </div>
  );
}

const HOME = hall(HOME_HALL);
const ROWS = questsOf(HOME_HALL).slice(0, 6);
const gold = new Intl.NumberFormat("en-US");

/** The Amber Hall's board, the way keasy's dashboard opens on it: three figures and the contracts. */
function Board() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto min-w-0">
          <p className="font-heading font-semibold text-lg leading-tight">{HOME.name}</p>
          <p className="text-muted-foreground text-sm">The board, as of 14 September 1312</p>
        </div>
        <InputGroup className="w-full sm:w-56">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search contracts" placeholder="Search contracts" />
        </InputGroup>
        <Button size="sm">
          <PlusIcon />
          Post a contract
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatRoot>
          <StatLabel>Open contracts</StatLabel>
          <StatValue>{openQuests().length}</StatValue>
          <StatTrend values={postedByMonth()} />
        </StatRoot>
        <StatRoot>
          <StatLabel>Gold on the board</StatLabel>
          <StatValue>{gold.format(boardValue())}</StatValue>
        </StatRoot>
        <StatRoot className="max-lg:hidden">
          <StatLabel>Overdue</StatLabel>
          <StatValue>{overdueQuests().length}</StatValue>
          <StatDelta goodWhenUp={false} value={1}>
            vs last week
          </StatDelta>
        </StatRoot>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contract</TableHead>
            <TableHead className="max-sm:hidden">Region</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-end max-sm:hidden">Reward</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((q) => {
            const state = questStatus(q.status);
            return (
              <TableRow key={q.id}>
                <TableCell className="max-w-0 sm:w-1/2">
                  <div className="truncate font-medium">{q.title}</div>
                  <div className="text-muted-foreground text-xs">{q.id}</div>
                </TableCell>
                <TableCell className="max-sm:hidden">
                  <Badge size="sm" variant="outline">
                    {q.region}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge size="sm" variant={state.tone}>
                    {state.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-end tabular-nums max-sm:hidden">{gold.format(q.reward)} g</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
