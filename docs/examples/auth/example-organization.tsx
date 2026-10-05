"use client";

import { AuthProvider, organizationOf, useSession } from "@kanzo-tech/auth";
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
import { HALLS, type HallId } from "@/example/world";
import { GUILD_SESSION, guildAuth } from "@/lib/guild-auth";

function Hall() {
  const { can, session, status } = useSession();

  // Nobody is *not* a member until the session has been read. `Gate` makes the same choice, and
  // for the same reason: a "no charter here" drawn at somebody who has one is worse than a beat of
  // nothing.
  if (status === "loading") return <Spinner />;

  // The hall this request is in, as the server's resolver named it — an address, which membership
  // either backs or does not.
  const alias = session?.organization ?? "";
  const organization = organizationOf(session, alias);

  return (
    <div className="flex w-full flex-col gap-4">
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertTitle>No charter in {HALLS.find((entry) => entry.id === alias)?.short}</AlertTitle>
            <AlertDescription>
              A hall the session does not carry resolves to nothing — never to the first one in the
              list.
            </AlertDescription>
          </Alert>
        }
        when={organization !== undefined}
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
          <DataListItem>
            <DataListItemLabel>can(&quot;warden&quot;)</DataListItemLabel>
            <DataListItemValue>{String(can("warden"))}</DataListItemValue>
          </DataListItem>
        </DataList>
      </Show>

      <p className="text-muted-foreground text-sm">
        Membership of {session?.organizations.length} halls, from the token. Which one you are
        looking at is a property of the request.
      </p>
    </div>
  );
}

export default function Example() {
  // In a product the server's resolver reads the hall off each request's URL; here the switcher
  // stands in for it. Never stored on the session record, which is what lets two tabs sit in two
  // halls at once: there is no shared value to fight over.
  const [alias, setAlias] = useState<HallId>("amber");
  const auth = useMemo(() => guildAuth({ ...GUILD_SESSION, organization: alias }), [alias]);

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
      <AuthProvider auth={auth}>
        <Hall />
      </AuthProvider>
    </div>
  );
}
