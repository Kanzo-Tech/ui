"use client";

import { AuthProvider, Gate, can, organizationOf, useSession } from "@kanzo-tech/auth";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ButtonGroup,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
  Show,
  Spinner,
} from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { HALLS, HOME_HALL, type HallId, hall } from "@/example/world";
import { guildAuth, roleLabel } from "@/lib/guild-auth";

function Board() {
  const { session, status } = useSession();
  const [alias, setAlias] = useState<HallId>(HOME_HALL);

  // The decision, spelled out beside the thing it decides: the membership the token carries for
  // this hall, and the predicate read over it.
  const here = organizationOf(session, alias);
  const warden = can(session, "warden", alias);

  if (status === "loading") return <Spinner />;

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      {/* All five halls, including the two the session carries no membership of: a switcher
          listing only your memberships cannot show what a closed-by-default predicate answers. */}
      <ButtonGroup aria-label="Hall">
        {HALLS.map((entry) => (
          <Button
            key={entry.id}
            onClick={() => setAlias(entry.id)}
            variant={entry.id === alias ? "default" : "outline"}
          >
            {entry.short}
          </Button>
        ))}
      </ButtonGroup>

      <DataList className="w-full">
        <DataListItem>
          <DataListItemLabel>Roles in {hall(alias).short}</DataListItemLabel>
          <DataListItemValue className="flex flex-wrap gap-1">
            <Show
              fallback={
                <span className="text-muted-foreground">
                  no membership — the token carries none here
                </span>
              }
              when={here !== undefined}
            >
              {here?.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {roleLabel(role)}
                </Badge>
              ))}
            </Show>
          </DataListItemValue>
        </DataListItem>
        <DataListItem>
          <DataListItemLabel className="font-mono">
            can(session, &quot;warden&quot;, &quot;{alias}&quot;)
          </DataListItemLabel>
          <DataListItemValue>
            <Badge variant={warden ? "success" : "outline"}>{String(warden)}</Badge>
          </DataListItemValue>
        </DataListItem>
      </DataList>

      {/* Same session, same `role`, a different answer: the question is asked *inside* `alias`. */}
      <Gate
        fallback={<Shut alias={alias} roles={here?.roles} />}
        organization={alias}
        role="warden"
      >
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Post a contract</ItemTitle>
            <ItemDescription>{hall(alias).motto}</ItemDescription>
          </ItemContent>
        </Item>
      </Gate>
    </div>
  );
}

/** Why it is shut, which is two different reasons and never the same one twice. */
function Shut({ alias, roles }: { alias: HallId; roles?: readonly string[] }) {
  return (
    <Alert variant={roles === undefined ? "destructive" : "default"}>
      <Show
        fallback={
          <>
            <AlertTitle>No membership of {hall(alias).short}</AlertTitle>
            <AlertDescription>
              {/* One `span`, not three children: the description slot is a grid, so a bare
                  expression beside its text would be drawn on a line of its own. */}
              <span>
                Closed by default: a hall the session does not carry is{" "}
                <span className="font-mono">false</span> rather than an error — and never the first
                hall it does carry.
              </span>
            </AlertDescription>
          </>
        }
        when={roles !== undefined}
      >
        <AlertTitle>Not a warden of {hall(alias).short}</AlertTitle>
        <AlertDescription>
          <span>
            The token makes you {roles?.map(roleLabel).join(" and ")} here, and a role held in one
            hall says nothing about another.
          </span>
        </AlertDescription>
      </Show>
    </Alert>
  );
}

export default function Example() {
  const auth = useMemo(() => guildAuth(), []);

  return (
    <AuthProvider auth={auth}>
      <Board />
    </AuthProvider>
  );
}
