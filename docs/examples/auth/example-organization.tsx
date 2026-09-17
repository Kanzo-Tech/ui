"use client";

import { AuthProvider, useOrganization, useSession } from "@kanzo-tech/auth";
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
  Show,
  Spinner,
} from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { HALLS, type HallId, hall } from "@/example/world";
import { guildAuth } from "@/lib/guild-auth";

function Switcher() {
  // The alias is held here rather than on the session, and in a product it is read off the URL.
  // That is what lets two tabs sit in two halls at once: there is no shared value to fight over.
  const [alias, setAlias] = useState<HallId>("amber");
  const { isMember, organization, organizations } = useOrganization(alias);
  const { status } = useSession();

  // Nobody is *not* a member until the session has been read. `Gate` makes the same choice, and
  // for the same reason: a "no charter here" drawn at somebody who has one is worse than a beat of
  // nothing.
  if (status === "loading") return <Spinner />;

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
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

      <Show
        fallback={
          <Alert variant="destructive">
            <AlertTitle>No charter in {hall(alias).short}</AlertTitle>
            <AlertDescription>
              A hall the session does not carry resolves to nothing — never to the first one in the
              list.
            </AlertDescription>
          </Alert>
        }
        when={isMember}
      >
        <DataList className="w-full">
          <DataListItem>
            <DataListItemLabel>Alias</DataListItemLabel>
            <DataListItemValue>{organization?.alias}</DataListItemValue>
          </DataListItem>
          <DataListItem>
            <DataListItemLabel>Id</DataListItemLabel>
            <DataListItemValue>{organization?.id}</DataListItemValue>
          </DataListItem>
          <DataListItem>
            <DataListItemLabel>Roles here</DataListItemLabel>
            <DataListItemValue>
              {organization?.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </DataListItemValue>
          </DataListItem>
        </DataList>
      </Show>

      <p className="text-muted-foreground text-sm">
        Membership of {organizations.length} halls, from the token. Which one you are looking at is
        a property of the request.
      </p>
    </div>
  );
}

export default function Example() {
  const auth = useMemo(() => guildAuth(), []);

  return (
    <AuthProvider auth={auth}>
      <Switcher />
    </AuthProvider>
  );
}
