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
          <Badge variant="info">Live</Badge>
        </SectionHeader>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Connection</CardTitle>
              <CardDescription>Where the dataset is pulled from.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel>Endpoint</FieldLabel>
                <Input defaultValue="https://api.example.org" />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>Verify TLS certificates</FieldLabel>
                <Switch defaultChecked />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Buttons re-skin with the accent token.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>Save</Button>
              <Button variant="secondary">Duplicate</Button>
              <Button variant="outline">Export</Button>
              <Button variant="destructive">Delete</Button>
            </CardContent>
          </Card>
        </div>
      </SectionRoot>

      {panel}
    </div>
  );
}
