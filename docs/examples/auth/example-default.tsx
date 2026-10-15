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
} from "@kanzo-tech/ui";
import { initialsOf } from "@/example/people";
import { GUILD_SESSION } from "@/lib/guild-auth";

function Identity() {
  // The session the server read for this page, from the first render; the two URLs are the edge's.
  const { session, signInUrl, signOutUrl } = useSession();

  return (
    <Show
      fallback={
        <ButtonGroup aria-label="Session">
          <ButtonGroupText>Nobody is signed in</ButtonGroupText>
          <Button asChild>
            <a href={signInUrl()}>Sign in</a>
          </Button>
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
          <Button asChild size="sm" variant="outline">
            <a href={signOutUrl("/")}>Sign out</a>
          </Button>
        </ItemActions>
      </Item>
    </Show>
  );
}

export default function Example() {
  // In a product, the server layout: `<AuthProvider session={await auth.session()}>`.
  return (
    <AuthProvider session={GUILD_SESSION}>
      <Identity />
    </AuthProvider>
  );
}
