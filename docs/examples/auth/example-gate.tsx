"use client";

import { AuthProvider, Gate } from "@kanzo-tech/auth";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ButtonGroup,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { type HallId, hall } from "@/example/world";
import { CHARTERED, guildAuth } from "@/lib/guild-auth";

function Board() {
  const [alias, setAlias] = useState<HallId>("amber");

  return (
    <div className="flex w-96 flex-col gap-4">
      <ButtonGroup aria-label="Hall">
        {CHARTERED.map((entry) => (
          <Button
            key={entry.id}
            onClick={() => setAlias(entry.id)}
            variant={entry.id === alias ? "default" : "outline"}
          >
            {entry.short}
          </Button>
        ))}
      </ButtonGroup>

      {/* The question is asked *inside* `alias`: a role held in one hall says nothing about
          another, so the branch changes while the session does not. */}
      <Gate
        fallback={
          <Alert>
            <AlertTitle>Not a warden of {hall(alias).short}</AlertTitle>
            <AlertDescription>Only a warden signs for a party.</AlertDescription>
          </Alert>
        }
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

export default function Example() {
  const auth = useMemo(() => guildAuth(), []);

  return (
    <AuthProvider auth={auth}>
      <Board />
    </AuthProvider>
  );
}
