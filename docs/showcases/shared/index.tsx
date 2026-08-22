"use client";

// The furniture two showcases were building twice.
//
// `field-notes` and `metadata-form` are the same arrangement seen from two sides: a workspace with
// a header, an activity rail, one `<main>` and panels that open beside it. Everything specific to
// either one stays in its own directory — this file holds only the parts that were being written
// twice and drifting apart while they were, which is exactly the drift `docs/CLAUDE.md` warns a
// showcase's specificity is allowed to produce and nobody had noticed:
//
//   · the panel headers were `h-9` in one showcase and `h-12` in the other;
//   · the tally badge was a `HoverCard` with a reveal in one and a plain `Badge` in the other;
//   · the activity rail existed in one of them, as a `ToggleGroup` standing in for a region.
//
// It is NOT a component library. A part here earns its place by having two call sites in
// `showcases/`, which is `decisions/an-export-needs-a-second-call-site.md` applied one layer down;
// anything with one call site belongs in that showcase's own directory.

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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ScrollArea,
  ShellAside,
  Status,
  ToggleGroup,
  ToggleGroupItem,
} from "@kanzo-tech/ui";
import { CalendarIcon, InfoIcon, SlidersHorizontalIcon as SlidersIcon, UsersIcon, XIcon } from "lucide-react";
import { Fragment, type ComponentType, type ReactNode } from "react";

/** One switch on the rail: which panel it opens, and how it is drawn and named. */
export interface RailPanel {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

/**
 * The activity rail — which panels are open, drawn as icons on the edge they open on.
 *
 * It is a `ShellAside` with a `ToggleGroup` inside, and it was a bare `ToggleGroup` standing in for
 * the region. That is not a detail of taste: a `ToggleGroup` is a CONTROL, so its recipe carries
 * `w-fit` and `rounded-lg`, and a control used as a region brought its 8 px radius with it — the
 * rail's top corner curled away from the header's border and left a step that reads as a second
 * border. Hand-setting `rounded-none` on it would have hidden that; giving the region to the
 * component whose job it is fixes it, and `ShellAside`'s own docblock names a dock as the case.
 *
 * `multiple`, because the panels are independent: the workspace's dock is the same machine with
 * `multiple={false}`, where exactly one panel shows at a time.
 */
export function PanelRail({
  label,
  onValueChange,
  panels,
  side = "start",
  value,
}: {
  label: string;
  onValueChange: (value: string[]) => void;
  panels: RailPanel[];
  side?: "start" | "end";
  value: string[];
}) {
  return (
    <ShellAside aria-label={label} className="shrink-0 bg-card" side={side}>
      <ToggleGroup
        className="rounded-none px-1.5 py-2"
        multiple
        onValueChange={(d) => onValueChange(d.value)}
        orientation="vertical"
        size="sm"
        spacing={2}
        value={value}
      >
        {panels.map((panel) => (
          <ToggleGroupItem
            aria-label={panel.label}
            key={panel.value}
            title={panel.label}
            value={panel.value}
          >
            <panel.icon aria-hidden />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ShellAside>
  );
}

/**
 * A panel's own header: what the panel is, a control that governs its document, and how it is
 * doing. `h-9` — the same height as the page header's own row, and as every strip on either screen.
 *
 * `actions` is for a control over THIS panel's document (the shape switcher, the standing-orders
 * switcher). A control that acts on the whole page belongs in the page header; one that replaces
 * the document a panel is showing belongs here, against the document.
 */
export function PaneHeader({
  actions,
  detail,
  icon: Icon,
  onClose,
  title,
  tone,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  onClose?: () => void;
  title: string;
  tone?: "destructive" | "info" | "success" | "warning";
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium text-xs">{title}</span>
      {actions}
      <span className="ms-auto flex min-w-0 items-center gap-1.5">
        {tone ? <Status className="size-1.5 shrink-0" variant={tone} /> : null}
        {detail ? (
          <span className="truncate text-muted-foreground text-xs" title={detail}>
            {detail}
          </span>
        ) : null}
        {onClose ? (
          <Button
            aria-label={`Close ${title}`}
            className="size-6 shrink-0 text-muted-foreground"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
          </Button>
        ) : null}
      </span>
    </div>
  );
}

/** One thing that is wrong somewhere, in the words of whoever noticed. */
export interface Finding {
  /** Where it is, in the reader's terms — a column, a field, a row and a column. */
  where: string;
  message: string;
}

/**
 * A tally that can be interrogated, and it is the same one on both screens.
 *
 * A count on its own asks the reader to go and find what it counted. Hovering lists every one of
 * them; pressing it shows them **where they are** — the fields on a form, the rows in a ledger. It
 * does not hide anything, and that is the change: this used to filter the ledger down to the
 * flagged rows, which answers "which ones" by removing the answer to "out of what".
 *
 * The reveal lives on the badge and not inside the card, because a hover card closes as soon as the
 * pointer leaves its trigger — a control in there is one you cannot reliably click. Hovering reads;
 * pressing acts; the same element owns both.
 */
export function FindingsBadge({
  active,
  findings,
  label,
  onToggle,
  summary,
  tone,
}: {
  active: boolean;
  findings: Finding[];
  label: string;
  onToggle: () => void;
  summary: string;
  tone: "destructive" | "success" | "warning";
}) {
  return (
    <HoverCard openDelay={80}>
      <HoverCardTrigger asChild>
        <button
          aria-label={active ? `Stop marking ${label}` : `Mark every ${label} where it is`}
          aria-pressed={active}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          disabled={findings.length === 0}
          onClick={onToggle}
          type="button"
        >
          <Badge className="tabular-nums" pill size="xs" variant={active ? tone : "outline"}>
            <Status className={cn("size-1.5", !active && "opacity-64")} variant={tone} />
            {/* The number is right-aligned in a fixed cell, so 9 → 10 does not move the label (2ch, because a run of this size counts in tens) and
                the label does not move whatever is beside it. A tally watched while it fills is a
                tally that must not shuffle its neighbours on every event. */}
            <span className="inline-block min-w-[2ch] text-end">{findings.length}</span> {label}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="font-medium text-sm">
            {findings.length} {label}
          </p>
          <p className="text-muted-foreground text-xs">{summary}</p>
        </div>
        <ScrollArea className="max-h-64">
          <ul className="divide-y">
            {findings.map((finding, i) => (
              <li className="flex items-start justify-between gap-3 px-3 py-1.5" key={i}>
                <span className="shrink-0 font-medium text-xs">{finding.where}</span>
                <span className="text-end text-muted-foreground text-xs">{finding.message}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          {active
            ? "Press the badge to stop marking them."
            : "Press the badge to mark them where they are."}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

/** One column of the workspace: what it is, what it renders, and how far it may be squeezed. */
export interface WorkspaceColumn {
  id: string;
  /** Percent of the row this column may not go below. */
  minSize: number;
  node: ReactNode;
}

/**
 * The workspace row: panels beside one `<main>`, every seam draggable.
 *
 * This was written out twice, identically, once in each showcase — the same `Resizable`, the same
 * `Fragment` loop, the same `key` on the open set, the same `ResizableResizeTrigger` between every
 * pair. Only the column ids and the default split differed, and both are arguments.
 *
 * Two things it decides rather than the caller. **One column is not a workspace**: with nothing to
 * resize against, the splitter is dead chrome and the single column is returned bare. And the
 * **`key` is the open set**, because Ark's splitter builds its panel model once — a column
 * appearing or leaving without a new key leaves the model describing a row that is no longer
 * there, and the drag ends up resizing the wrong seam.
 */
export function WorkspaceColumns({
  columns,
  defaultSize,
}: {
  columns: WorkspaceColumn[];
  defaultSize: number[];
}) {
  if (columns.length === 1) return columns[0]?.node ?? null;

  return (
    <Resizable
      defaultSize={defaultSize}
      key={columns.map((column) => column.id).join("-")}
      panels={columns.map(({ id, minSize }) => ({ id, minSize }))}
    >
      {columns.map((column, i) => (
        <Fragment key={column.id}>
          {i > 0 ? (
            <ResizableResizeTrigger id={`${columns[i - 1]?.id}:${column.id}`} withHandle />
          ) : null}
          <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id={column.id}>
            {column.node}
          </ResizablePanel>
        </Fragment>
      ))}
    </Resizable>
  );
}

/**
 * A screen, not a parts bin — the thing a theme is actually judged on.
 *
 * Shared because it has two call sites and they need the *same* screen, not a similar one. The
 * studio shows it once, wearing the values you are editing; the gallery shows it many times, each
 * wearing a different shipped theme. If the two drifted, the gallery would be comparing themes
 * through two different interfaces and the comparison would be worthless — which is the failure
 * this file exists to prevent, stated in its header.
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
    <div className="flex flex-col gap-5">
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
