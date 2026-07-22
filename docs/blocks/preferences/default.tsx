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
  Preferences,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Switch,
} from "@kanzo-tech/ui";

/**
 * Preferences, shown the way it actually works.
 *
 * The docs example could not do this. `PreferencesPanel` is `Portal`ed and `position: fixed`,
 * so inside a framed 450px preview box it escapes to the viewport and lands on top of the
 * documentation. The example therefore cheated: it rendered the eight sections loose in a
 * `div`, which shows the controls but not the component — no trigger, no drawer, none of the
 * behaviour that makes it what it is.
 *
 * An iframe gives it its own viewport, which is the only honest way to show a fixed-position
 * panel. Same reason blocks exist.
 *
 * `defaultOpen` so the panel is visible on arrival — the point of the page is the panel, and
 * making a reader hunt for the FAB first would waste the demonstration. The FAB is still there,
 * and toggling it is the thing to try: the panel is non-modal and does not close on outside
 * click, so you can keep editing the form behind it while the theme changes live.
 */
export function PreferencesBlock() {
  return (
    <div className="min-h-svh bg-background p-8">
      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitleGroup>
            <SectionTitle level={1} scale="page">
              Settings
            </SectionTitle>
            <SectionDescription>
              Ordinary product chrome, here only so the live re-theming has something to act on.
              Open the palette in the corner and change the accent, radius or density — every
              control below re-skins without re-rendering.
            </SectionDescription>
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

      {/* The component itself, whole: floating trigger + non-modal drawer. */}
      <Preferences defaultOpen />
    </div>
  );
}

export default PreferencesBlock;
