"use client";

import { AuthProvider, useSession } from "@kanzo-tech/auth";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupText,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Show,
  Spinner,
} from "@kanzo-tech/ui";
import { useMemo } from "react";
import { initialsOf } from "@/example/people";
import { guildAuth } from "@/lib/guild-auth";

function Identity() {
  const { session, signIn, signOut, status } = useSession();

  // `status`, never `session === null`: one value cannot tell "anonymous" from "not looked yet".
  if (status === "loading") return <Spinner />;

  return (
    <Show
      fallback={
        <ButtonGroup aria-label="Session">
          <ButtonGroupText>Nobody is signed in</ButtonGroupText>
          <Button onClick={() => void signIn()}>Sign in</Button>
        </ButtonGroup>
      }
      when={session !== null}
    >
      <Item className="w-96" variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarFallback>{initialsOf(session?.user.name ?? "")}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{session?.user.name}</ItemTitle>
          <ItemDescription>
            {session?.user.email} · {session?.organizations.length} halls
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {/* Realm roles: global to the person, and kept apart from what she is inside a hall. */}
          {session?.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {role}
            </Badge>
          ))}
          <Button onClick={() => void signOut()} size="sm" variant="outline">
            Sign out
          </Button>
        </ItemActions>
      </Item>
    </Show>
  );
}

export default function Example() {
  // Memoised because the provider re-reads the session whenever this identity changes, and a new
  // `Auth` on every render is a new subscription on every render.
  const auth = useMemo(() => guildAuth(), []);

  return (
    <AuthProvider auth={auth}>
      <Identity />
    </AuthProvider>
  );
}
