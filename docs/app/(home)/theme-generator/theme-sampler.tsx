"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  Input,
  NativeSelect,
  NativeSelectOption,
  Progress,
  ProgressValue,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Slider,
  SliderLabel,
  SliderValue,
  Status,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kanzo-tech/ui";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";

/**
 * What a theme is actually judged on: the components, grouped by the knob each one answers.
 *
 * **This replaced a mock screen, and the swap is the whole argument.** The catalogue's tiles draw
 * `ThemeScreen` — a week strip, a member list, a settings form — and that is right *there*: a
 * thumbnail has to read as a product at a glance, and a parts bin at 0.6 zoom reads as noise. It is
 * the wrong thing *here*. A generator's preview is not a picture of an application; it is the
 * question "does this theme work", and that question is answered token by token. Three cards could
 * not show a `secondary` button, a disabled control, an invalid field, a ghost hover or a fifth
 * status, so a knob you turned on the left changed nothing you could see on the right — which is
 * precisely the failure the pane exists to prevent. daisyUI's generator does the same thing for the
 * same reason: its preview is every component it ships, on the theme.
 *
 * ## Every group answers a control
 *
 * `Buttons` for the brand fills and their inks, and for `--depth`, `--stroke` and the field radius
 * doing real work at three sizes. `Status` for all four families in both of their jobs — the fill
 * with `-content` on it, and the same family read on the page. `Fields` for `--field`, `--input`
 * and the selector radius, which nothing else on the page shows. `Surfaces` for the three grounds
 * and the line between them. `States` for `--accent`, `--ring` and `--popover`, none of which any
 * other group shows — and two of those have a knob on the left, so before this group existed a
 * reader could turn one and watch nothing happen. `Type` for the two font axes.
 *
 * A group that no control moves would be decoration, and `Categorical` is the one that has to
 * argue for itself: **no knob on the left edits `--chart-*`**, and it is not decoration anyway.
 * *Start from* moves it — a theme that authors its own eight shows its own eight, and one that
 * authors none shows the set `tokens.css` publishes — and that difference is the single thing about
 * the categorical channel a theme author has to know, because it is the one part of a theme you get
 * without writing it. Editing them is a text editor's job: there are eight of them, they answer to
 * separation rather than to taste, and a picker per slot would invite exactly the fiddling that
 * `decisions/the-categorical-default-is-one-set-for-every-theme.md` measured its way out of.
 *
 * ## Nothing here portals
 *
 * No menu, no dialog, no tooltip, no toast — and the omission is deliberate rather than lazy. Ark
 * portals an overlay to `document.body`, which is *outside* the element carrying this theme's
 * values as inline custom properties, so an overlay opened here would paint the page's theme while
 * claiming to preview yours. The one honest place to judge those is a theme applied to `<html>`,
 * which is what **Wear it** on the [catalogue](/docs/themes) is for.
 */
export function ThemeSampler() {
  return (
    // A container query, not a media query: what decides the column count is the width of THIS
    // pane, which a reader changes by resizing a window the breakpoints know nothing about.
    // Multi-column rather than a grid, so a short group packs under a tall one instead of leaving
    // the hole a two-column grid of unequal cards always leaves.
    <div className="@container">
      <div className="gap-4 @4xl:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <Group title="Buttons" doc="the brand fills, the field radius, --stroke and --depth">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Claim</Button>
            <Button size="sm" variant="secondary">
              Assign
            </Button>
            <Button size="sm" variant="outline">
              Re-post
            </Button>
            <Button size="sm" variant="ghost">
              Notes
            </Button>
            <Button size="sm" variant="destructive">
              Withdraw
            </Button>
            <Button size="sm" variant="link">
              Terms
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Group>

        <Group title="Status" doc="each family twice — on its fill, and read on the page">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>Claimed</Badge>
            <Badge variant="secondary">Member</Badge>
            <Badge variant="outline">Invited</Badge>
            <Badge variant="success">Settled</Badge>
            <Badge variant="warning">Afield</Badge>
            <Badge variant="destructive">Failed</Badge>
            <Badge variant="info">Open</Badge>
          </div>
          {/* `Status` is a DOT, not a chip — `size-2` with a `ring-background` around it. Given
              children it squashes the word into an 8px circle, which is what the first draft of
              this file did. The label goes beside it. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {STATES.map((state) => (
              <span className="inline-flex items-center gap-2" key={state.label}>
                <Status variant={state.variant} />
                {state.label}
              </span>
            ))}
          </div>
          <Alert variant="warning">
            <TriangleAlertIcon />
            <AlertTitle>Six days overdue</AlertTitle>
            <AlertDescription>A re-posting is not the place to blood a copper.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>The party did not come back</AlertTitle>
          </Alert>
          <div className="flex flex-col gap-2 @md:flex-row">
            <Alert className="flex-1" variant="success">
              <CircleCheckIcon />
              <AlertTitle>Settled</AlertTitle>
            </Alert>
            <Alert className="flex-1" variant="info">
              <InfoIcon />
              <AlertTitle>Second attempt</AlertTitle>
            </Alert>
          </div>
        </Group>

        <Group title="Fields" doc="--field, --input, the selector radius and the two size units">
          <div className="flex flex-col gap-2">
            <Input defaultValue="Ashgrove Hall" placeholder="Workspace name" />
            <Input aria-invalid defaultValue="not a hall" />
            <NativeSelect className="w-full" defaultValue="amber">
              <NativeSelectOption value="amber">Amber Hall</NativeSelectOption>
              <NativeSelectOption value="thorn">Thornmarch</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Checkbox defaultChecked>Notify me</Checkbox>
            <Checkbox>Auto-assign</Checkbox>
            <Checkbox disabled>Locked</Checkbox>
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked />
              Open board
            </label>
          </div>
          <RadioGroup className="flex flex-row flex-wrap gap-x-5" defaultValue="warden">
            <RadioGroupItem value="warden">Warden</RadioGroupItem>
            <RadioGroupItem value="scout">Scout</RadioGroupItem>
            <RadioGroupItem value="cantor">Cantor</RadioGroupItem>
          </RadioGroup>
          <Slider defaultValue={[32]} max={200}>
            <div className="flex items-center">
              <SliderLabel>Reward, in gold</SliderLabel>
              <SliderValue />
            </div>
          </Slider>
          <Progress value={64}>
            <ProgressValue />
          </Progress>
        </Group>

        <Group title="Surfaces" doc="the three grounds, the line between them, and both weights of ink">
          <Tabs defaultValue="board">
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="party">Party</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent className="pt-1 text-muted-foreground text-sm" value="board">
              Grade 5 — a writ. Six days overdue.
            </TabsContent>
            <TabsContent className="pt-1 text-muted-foreground text-sm" value="party">
              Dagfinn Roe, warden. Solveig Marsh, sapper.
            </TabsContent>
            <TabsContent className="pt-1 text-muted-foreground text-sm" value="notes">
              Basilisks keep to quarries and cut stone.
            </TabsContent>
          </Tabs>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>The quarry road</TableCell>
                <TableCell>
                  <Badge variant="success">Settled</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Saltmere ferry</TableCell>
                <TableCell>
                  <Badge variant="warning">Afield</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* The muted ground, which nothing above shows on its own — a recessed strip is where a
              theme's third surface either separates from the card or disappears into it. */}
          <div className="rounded-box bg-muted p-3">
            <p className="font-medium text-sm">Muted</p>
            <p className="text-muted-foreground text-sm">
              The recessed ground, with the lighter of the two inks on it.
            </p>
          </div>
          <Separator />
        </Group>

        <Group title="States" doc="--accent, --ring and --popover, which nothing else on this page shows">
          {/* **The gap this group closes.** Three of the twenty-one had no specimen anywhere in the
              preview, and two of them have a control on the left — so a reader turned `accent` or
              `ring` and the pane did not move, which is the exact failure this pane exists to
              prevent, running the other way. */}
          <div className="overflow-hidden rounded-field border border-border">
            {ROWS.map((row) => (
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm",
                  row.on && "bg-accent text-accent-foreground",
                )}
                key={row.label}
              >
                <span>{row.label}</span>
                <span className="text-xs opacity-64">{row.note}</span>
              </div>
            ))}
          </div>

          {/* Drawn rather than waited for. A focus ring only exists while something has focus, and a
              preview nobody is tabbing through would never show `--ring` at all — so this paints the
              same three-pixel ring the recipes do, on a resting field. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-field border border-input bg-field px-3 py-2 text-sm ring-[3px] ring-ring">
              Focused
            </span>
            <span className="text-muted-foreground text-xs">`--ring`, as the recipes draw it</span>
          </div>

          {/* The lifted surface. Eight themes author `--popover` and they are all dark ones — an
              overlay peels off the card on that side and is the card on the light one — so on a
              light theme this panel is deliberately indistinguishable from the ones above it, and
              that sameness is the thing worth seeing. */}
          <div className="rounded-box border border-border bg-popover p-3 text-popover-foreground shadow-lg">
            <p className="font-medium text-sm">Lifted</p>
            <p className="text-muted-foreground text-xs">
              `--popover`, which defers to `--card` until a theme says otherwise.
            </p>
          </div>
        </Group>

        <Group title="Type" doc="the heading face and the body face, which a theme may carry">
          <p className="font-heading font-semibold text-2xl leading-tight">
            The quarry has opened onto something older
          </p>
          <p className="text-sm">
            A contract is a promise about who goes, what they carry, and what the hall owes them
            when they come back. Everything else is a note in the margin.
          </p>
          <p className="text-muted-foreground text-sm">
            The same sentence at the lighter weight, which is where a muted ink is really judged.
          </p>
          <code className="block rounded-field bg-muted px-2 py-1 font-mono text-xs">
            --font-mono: the face a token block is read in
          </code>
        </Group>

        <Group title="Categorical" doc="the eight chart slots — most themes inherit them">
          <div className="flex flex-wrap gap-1.5">
            {SLOTS.map((slot) => (
              <span
                className="size-7 rounded-selector ring-1 ring-border"
                key={slot}
                style={{ background: `var(--chart-${slot})` }}
                title={`--chart-${slot}`}
              />
            ))}
          </div>
          {/* Bars rather than only swatches: a categorical set is judged as marks on the page's own
              ground, at the size a chart actually draws them, standing on a baseline. */}
          <div className="flex h-20 items-end gap-2 border-border border-b pb-px">
            {SLOTS.map((slot) => (
              <span
                className="w-full max-w-8 flex-1 rounded-t-selector"
                key={slot}
                style={{ background: `var(--chart-${slot})`, height: `${BAR_HEIGHTS[slot - 1]}%` }}
              />
            ))}
          </div>
        </Group>
      </div>
    </div>
  );
}

/** The dot vocabulary, which is where a status fill is smallest and its ring matters most. */
const STATES = [
  { label: "Settled", variant: "success" },
  { label: "Afield", variant: "warning" },
  { label: "Failed", variant: "destructive" },
  { label: "Open", variant: "info" },
] as const;

/** A resting row, a hovered one and a chosen one — the three states `--accent` is the ground for. */
const ROWS = [
  { label: "The quarry road", note: "resting", on: false },
  { label: "Saltmere ferry", note: "hovered", on: true },
  { label: "Coldiron pass", note: "selected", on: true },
];

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
/** Fixed, not random: a preview that reshuffles on every keystroke is a preview you cannot compare. */
const BAR_HEIGHTS = [82, 54, 96, 38, 67, 45, 74, 29];

/**
 * One group of specimens, in a card.
 *
 * A `Card` and not a bare box, because the card IS a specimen: everything below sits on `--card`
 * over `--background`, which is the pair a theme most often gets wrong and the one a flat list of
 * controls on the page never shows.
 */
function Group({
  children,
  className,
  doc,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  doc: string;
  title: string;
}) {
  return (
    <Card className={cn("@container flex flex-col gap-3 p-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs">{doc}</p>
      </div>
      {children}
    </Card>
  );
}
