"use client";

import { claims, roleFromGroupPath } from "@kanzo-tech/auth";
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
import { BOARD, GROUPS, GUILD_CLAIMS, LEDGER, roleLabel } from "@/lib/guild-auth";

/** Every group path the claim set carries, with the hall whose membership it came from. */
const PATHS = Object.entries(GROUPS).flatMap(([alias, paths]) =>
  (paths ?? []).map((path) => ({ alias: alias as HallId, path })),
);

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
              <TableHead className="w-56">Group path</TableHead>
              <TableHead className="w-32">Hall</TableHead>
              <TableHead>roleFromGroupPath(path, &quot;{clientId}&quot;)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PATHS.map(({ alias, path }) => {
              const role = roleFromGroupPath(path, clientId);

              return (
                <TableRow key={`${alias}${path}`}>
                  <TableCell className="font-mono text-xs">{path}</TableCell>
                  <TableCell className="text-muted-foreground">{hall(alias).short}</TableCell>
                  <TableCell>
                    <Show
                      fallback={
                        <span className="text-muted-foreground">
                          <span className="font-mono">null</span>{" "}
                          — another application&rsquo;s role, dropped
                        </span>
                      }
                      when={role !== null}
                    >
                      <Badge variant="secondary">{roleLabel(role ?? "")}</Badge>
                    </Show>
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
