"use client";

import { claims, organizationOf } from "@kanzo-tech/auth";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupText,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  JsonTreeView,
  Show,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { type HallId, hall } from "@/example/world";
import { BOARD, CHARTERS, GUILD_CLAIMS, LEDGER, roleLabel } from "@/lib/guild-auth";

/** Every hall the claim set carries an entry for, with the groups that entry names. */
const ENTRIES = Object.entries(CHARTERS).map(([alias, charter]) => ({
  alias: alias as HallId,
  groups: charter?.groups ?? [],
}));

export default function Example() {
  const [clientId, setClientId] = useState<string>(BOARD);
  // The real reader, on a real claim set. Nothing is stored and no session is held: claims in,
  // `Session` out, and the whole of what changes below is which application is asking.
  const session = useMemo(() => claims(GUILD_CLAIMS, { clientId }), [clientId]);

  return (
    <div className="flex w-full flex-col gap-4">
      <ButtonGroup aria-label="Reading client">
        <ButtonGroupText>Read as client</ButtonGroupText>
        {[BOARD, LEDGER].map((id) => (
          <Button
            key={id}
            onClick={() => setClientId(id)}
            variant={id === clientId ? "default" : "outline"}
          >
            {id}
          </Button>
        ))}
      </ButtonGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>The claim set</CardTitle>
            <CardDescription>Decoded off the ID token, as Keycloak emits it.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonTreeView data={GUILD_CLAIMS} defaultExpandedDepth={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="font-mono text-sm">
                claims(token, {`{ clientId: "${clientId}" }`})
              </span>
            </CardTitle>
            <CardDescription>
              Realm roles sit on the person; a hall&rsquo;s roles sit on that hall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataList>
              <DataListItem>
                <DataListItemLabel>user</DataListItemLabel>
                <DataListItemValue>
                  {session.user.name} · <span className="font-mono">{session.user.id}</span>
                </DataListItemValue>
              </DataListItem>
              <DataListItem>
                <DataListItemLabel>roles</DataListItemLabel>
                <DataListItemValue className="flex flex-wrap gap-1">
                  {session.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {roleLabel(role)}
                    </Badge>
                  ))}
                </DataListItemValue>
              </DataListItem>
              {/* Membership comes from the claim and survives the switch; the roles inside it do
                  not. Read as the ledger, two of the three halls are memberships with nothing in
                  them. */}
              {session.organizations.map((org) => (
                <DataListItem key={org.alias}>
                  <DataListItemLabel>organizations · {org.alias}</DataListItemLabel>
                  <DataListItemValue className="flex flex-wrap gap-1">
                    <Show
                      fallback={<span className="text-muted-foreground">no roles here</span>}
                      when={org.roles.length > 0}
                    >
                      {org.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {roleLabel(role)}
                        </Badge>
                      ))}
                    </Show>
                  </DataListItemValue>
                </DataListItem>
              ))}
              <DataListItem>
                <DataListItemLabel>expiresAt</DataListItemLabel>
                <DataListItemValue className="font-mono text-xs">
                  {new Date(session.expiresAt).toISOString()}
                </DataListItemValue>
              </DataListItem>
            </DataList>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Hall</TableHead>
              <TableHead className="w-48">groups — never read</TableHead>
              <TableHead>resource_access.{clientId}.roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ENTRIES.map(({ alias, groups }) => {
              const roles = organizationOf(session, alias)?.roles ?? [];

              return (
                <TableRow key={alias}>
                  <TableCell>{hall(alias).short}</TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    {groups.join(", ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Show
                        fallback={
                          <span className="text-muted-foreground">
                            a member, holding nothing for {clientId}
                          </span>
                        }
                        when={roles.length > 0}
                      >
                        {roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </Show>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
