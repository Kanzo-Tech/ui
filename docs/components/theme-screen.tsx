"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  Field,
  FieldLabel,
  FieldTitle,
  Input,
} from "@kanzo-tech/ui";
import {
  CalendarIcon,
  InfoIcon,
  SlidersHorizontalIcon as SlidersIcon,
  UsersIcon,
} from "lucide-react";

/**
 * A screen, not a parts bin — the thing a theme is actually judged on.
 *
 * Its one consumer is the [catalogue](/docs/themes), which draws it once per shipped theme.
 *
 * **It had a second, and losing it was the point.** The generator previewed this same screen, and
 * that is the wrong thing for a generator: a preview there has to answer the control you just
 * turned, and three cards cannot show a `secondary` button, a disabled control, an invalid field
 * or a fifth status. That pane draws `ThemeSampler` now — the components, grouped by the knob each
 * answers — and this stayed with the job it is right for. A tile is a *thumbnail*: at 0.6 zoom it
 * has to read as a product in one glance, and a parts bin at that size reads as noise.
 *
 * It lived in `showcases/shared/` while both consumers were showcases. Neither is now, and that
 * file admits a part on the rule that it has two call sites *in `showcases/`*.
 *
 * The first draft laid the components out in a row — five buttons, an input, a checkbox — and it
 * read as a test page, because that is what it was. **The reference does not do that.** Its preview
 * is realistic fragments in cards: a filter list with counts, a week strip with today filled in the
 * brand, an event row, tabs. The difference is not decoration — a theme is judged on whether an
 * *interface* holds together, and a row of loose controls cannot show that. A brand fill only looks
 * right or wrong next to the surface it sits on and the ink it carries.
 *
 * Each fragment below is here because it is the only reader of something: the week strip for
 * `--primary` doing real work at small size, the list for `--border` and `--muted-foreground` at
 * their real weights, the status row for all eight status tokens at once, the form for the field
 * radius and height. A fragment that moves under no knob would be decoration.
 */
export function ThemeScreen() {
  return (
    // A container, because its two call sites give it very different room: a catalogue tile is
    // 355px and the page it is on is 1,400. The fragments below query THIS box rather than the
    // window, which is what lets the tile drop the `zoom` it used to shrink itself with.
    <div className="@container flex flex-col gap-5">
      {/* **First, because first is most of what gets seen.** A catalogue tile crops this screen at
          around 400px, so whatever opens it is the specimen for twenty-nine themes at a glance —
          and what opened it was a calendar strip, which carries `--primary` and `--card` and
          nothing else. This one fragment carries seven: both grounds, both weights of ink, the
          brand fill with its ink, the quiet button, the line between them and one status. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ashgrove Hall</CardTitle>
          <p className="text-muted-foreground text-sm">
            Four contracts on the board, one of them afield.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm">Claim</Button>
          <Button size="sm" variant="secondary">
            Assign
          </Button>
          <Button size="sm" variant="outline">
            Notes
          </Button>
          <Badge className="ms-auto" variant="warning">
            Afield
          </Badge>
        </CardContent>
      </Card>

      {/* A week, with today carrying the brand. The smallest thing that shows a fill working. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarIcon className="size-4 text-muted-foreground" />
            This week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5">
            {["12 M", "13 T", "14 W", "15 T", "16 F", "17 S", "18 S"].map((day, i) => {
              const [n, d] = day.split(" ");
              const today = i === 2;
              return (
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 rounded-field py-2",
                    today ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                  key={day}
                >
                  <span className="font-semibold text-sm tabular-nums">{n}</span>
                  <span className={cn("text-[10px]", today ? "opacity-80" : "text-muted-foreground")}>{d}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* A list at real weights: the hairline between rows, the muted count, a badge per state. */}
      <Card>
        <CardHeader className="pb-3">
          {/* `CardHeader` lays its children out in a grid, so a second child lands on a second row.
              One flex row inside it is the composition, not a fight with the recipe. */}
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-muted-foreground" />
              Members
            </CardTitle>
            <Button size="sm" variant="ghost">
              Invite
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col">
          {[
            { name: "Ada Whitlock", role: "Owner", tone: "default" as const },
            { name: "Rune Ashgrove", role: "Editor", tone: "secondary" as const },
            { name: "Mira Sandoval", role: "Invited", tone: "warning" as const },
          ].map((person, i) => (
            <div
              className={cn(
                "flex items-center gap-3 py-2.5",
                i > 0 && "border-border border-t",
              )}
              key={person.name}
            >
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
              >
                {person.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
              <Badge variant={person.tone}>{person.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* The form half: field radius, field height, the checkbox and its selector knobs. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <SlidersIcon className="size-4 text-muted-foreground" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Workspace name</FieldLabel>
            <Input defaultValue="Ashgrove Hall" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox defaultChecked />
            <FieldTitle>Notify me when a party signs</FieldTitle>
          </Field>
          <div className="flex flex-wrap items-center gap-2 border-border border-t pt-4">
            <Button>Save changes</Button>
            <Button variant="outline">Cancel</Button>
            <Button className="ms-auto" variant="destructive">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All four status families, fill and on-fill ink, in one glance. */}
      <div className="grid gap-3 @2xl:grid-cols-2">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>A status tint</AlertTitle>
          <AlertDescription>
            Painted as a dilution of the status colour, which is what an alpha step used to be.
          </AlertDescription>
        </Alert>
        <Card className="flex flex-col justify-center gap-2 p-4">
          <span className="text-muted-foreground text-xs">Fills and their inks</span>
          <div className="flex flex-wrap gap-1.5">
            {(["destructive", "info", "success", "warning"] as const).map((tone) => (
              <span
                className="rounded-selector px-2 py-1 font-medium text-xs"
                key={tone}
                style={{ background: `var(--${tone})`, color: `var(--${tone}-content)` }}
              >
                {tone}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
