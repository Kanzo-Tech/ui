"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Switch,
} from "@kanzo-tech/ui";
import type { ReactNode } from "react";
import { hall, HOME_HALL } from "@/example/world";

// Shared settings-page chrome the Preferences variants float their real drawer over.
export function SettingsBackdrop({
  description,
  panel,
}: {
  description: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background p-8">
      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitleGroup>
            <SectionTitle level={1} scale="page">
              Settings
            </SectionTitle>
            <SectionDescription>{description}</SectionDescription>
          </SectionTitleGroup>
          {/* No appearance control here — `PreferencesPanel` carries one in its own header. */}
          <div className="flex items-center gap-2">
            <Badge variant="info">Live</Badge>
          </div>
        </SectionHeader>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>The hall</CardTitle>
              <CardDescription>How the board signs a contract.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel>Hall</FieldLabel>
                <Input defaultValue={hall(HOME_HALL).name} />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>Require an archivist's seal</FieldLabel>
                <Switch defaultChecked />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Buttons re-skin with the radius and density axes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>Post</Button>
              <Button variant="secondary">Duplicate</Button>
              <Button variant="outline">Export</Button>
              <Button variant="destructive">Withdraw</Button>
            </CardContent>
          </Card>
        </div>
      </SectionRoot>

      {panel}
    </div>
  );
}
