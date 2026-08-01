"use client";

import {
  AppearanceToggle,
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
import { hall, HOME_HALL } from "@/example/world";

/**
 * Preferences, shown the way it actually works.
 *
 * The docs example could not do this. `PreferencesPanel` is `Portal`ed and `position: fixed`,
 * so inside a framed 450px preview box it escapes to the viewport and lands on top of the
 * documentation. The example therefore cheated: it rendered the sections loose in a `div`,
 * which shows the controls but not the component — no trigger, no drawer, none of the
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
export function PreferencesShowcase() {
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
              Open the panel in the corner and change the radius or density — every control below
              re-skins without re-rendering. Appearance is the toggle beside the badge: one button,
              cycling light → dark → system.
            </SectionDescription>
          </SectionTitleGroup>
          {/* Appearance is not in the drawer: it has one control, and this is where it lives. */}
          <div className="flex items-center gap-2">
            <AppearanceToggle />
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

      {/* The component itself, whole: floating trigger + non-modal drawer. */}
      <Preferences defaultOpen />
    </div>
  );
}

export default PreferencesShowcase;
