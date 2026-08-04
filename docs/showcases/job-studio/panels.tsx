"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  createListCollection,
  Field,
  FieldDescription,
  FieldLabel,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  Float,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Show,
  Spinner,
  Switch,
} from "@kanzo-tech/ui";
import {
  BookMarkedIcon,
  CheckIcon,
  CalendarClockIcon,
  DatabaseIcon,
  GripVerticalIcon,
  PlugZapIcon,
  ShapesIcon,
  ZapIcon,
} from "lucide-react";
import { connectionDragProps } from "./connection-slots";
import { type Connection, CONNECTIONS, DESTINATIONS, ORGANISATION, type RunMode } from "./data";
import { type Finding, mappingsIn } from "./fossil-lang";

// ── The connections rail ──────────────────────────────────────────────────────

const KIND_ICON = { data: DatabaseIcon, vocab: BookMarkedIcon } as const;
const KIND_LABEL = { data: "data source", vocab: "RDF vocabulary" } as const;

/**
 * What the editor needs at hand: the connections a program can reference.
 *
 * Each row is a CARD, not a line of text — it is a thing you pick up and move, and the flat
 * list read as prose you happen to be able to drag. `Item` in its `outline` variant is that
 * card: a media slot for the kind, the name and its URL, and the grip in `ItemActions` where a
 * row's affordances belong.
 */
export function ConnectionsPanel({
  onInsert,
  used,
  openSlots,
}: {
  onInsert: (connection: Connection) => void;
  used: Set<string>;
  /** How many sockets are still empty — the rail says what the drag is FOR. */
  openSlots: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
      <p className="text-muted-foreground text-xs">
        {openSlots > 0
          ? `Drag one onto the ${openSlots === 1 ? "empty socket" : `${openSlots} empty sockets`} in the program.`
          : "Drag one into the program, or press @ in the editor."}
      </p>

      <Show
        fallback={
          <Item className="mx-auto max-w-[420px] flex-col gap-2 py-8 text-center">
            <ItemMedia
              className="group-has-data-[slot=item-description]/item:self-center text-muted-foreground [&_svg:not([class*='size-'])]:size-8"
              variant="icon"
            >
              <PlugZapIcon />
            </ItemMedia>
            <ItemTitle className="text-base">No connections yet</ItemTitle>
            <ItemDescription>A job reads through a connection. Wire one under Connections and it becomes referenceable as @name.</ItemDescription>
          </Item>
        }
        when={CONNECTIONS.length > 0}
      >
        <ItemGroup className="gap-2">
          {CONNECTIONS.map((c) => {
            const Icon = KIND_ICON[c.kind];
            return (
              // Draggable AND clickable. A drop is a pointer-only gesture, so the click path
              // (insert at the caret) is not a nicety — it is the same action for anyone not
              // using a mouse, alongside the socket's own keyboard route.
              <Item asChild key={c.id} variant="outline">
                <button
                  className="w-full cursor-grab text-start transition-colors hover:border-primary/40 active:cursor-grabbing"
                  onClick={() => onInsert(c)}
                  type="button"
                  {...connectionDragProps(c)}
                >
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="font-mono">
                      @{c.name}
                      <Show when={used.has(c.name)}>
                        <Badge size="xs" variant="secondary">
                          in use
                        </Badge>
                      </Show>
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1 text-xs">{c.url}</ItemDescription>
                    <span className="text-faint text-xs">{KIND_LABEL[c.kind]}</span>
                  </ItemContent>
                  <ItemActions>
                    <GripVerticalIcon className="size-4 text-faint" />
                  </ItemActions>
                </button>
              </Item>
            );
          })}
        </ItemGroup>
      </Show>
    </div>
  );
}

// ── The configure screen ──────────────────────────────────────────────────────

const destinations = createListCollection({
  items: DESTINATIONS.map((c) => ({ label: `@${c.name}`, value: c.id, url: c.url })),
});

export interface ConfigValues {
  runMode: RunMode;
  destinationId: string | null;
  dcat: boolean;
}

/** One setting, said the way a settings page says it: what it is on the left, the control on
 *  the right. Below the container's `@2xl` the two stack, because at that width a 16rem label
 *  column leaves nothing for the control. */
function Setting({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 @2xl:grid-cols-[15rem_minmax(0,1fr)] @2xl:gap-10">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-muted-foreground text-sm leading-snug">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * The settings page.
 *
 * It was a `max-w-2xl` stack of `Card`s first — three controls in a narrow column with a great
 * deal of nothing either side of it. metadata-form's column earns its measure because it holds
 * thirty fields; three settings do not, and cards around single controls are chrome standing in
 * for content. So it is the shape a settings page actually has — the explanation on the left, the
 * control on the right, a rule between sections — which fills the width with sentences rather
 * than padding.
 *
 * Container queries, not viewport ones: what is narrow here is the page minus the sidebar.
 */
export function ConfigureForm({
  values,
  onChange,
  jobName,
}: {
  values: ConfigValues;
  onChange: (patch: Partial<ConfigValues>) => void;
  /** Only to show the path the output will actually land on. */
  jobName: string;
}) {
  const set = <K extends keyof ConfigValues>(key: K, value: ConfigValues[K]) =>
    onChange({ [key]: value } as Partial<ConfigValues>);

  const destination = DESTINATIONS.find((c) => c.id === values.destinationId);
  const slug = (jobName || "unnamed-job").trim().toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="@container mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold text-lg">Configure</h2>
        <p className="text-muted-foreground text-sm">
          When this job runs, and where the graph it produces is written.
        </p>
      </div>

      <Separator />

      <Setting
        description="Integrated jobs run once, as soon as they are created. A schedule repeats them."
        title="Run mode"
      >
        <RadioGroup
          columns={2}
          onValueChange={(d) => d.value && set("runMode", d.value as RunMode)}
          value={values.runMode}
        >
          <RadioGroupCard className="items-start" value="integrated">
            <ZapIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <RadioGroupText>Integrated</RadioGroupText>
              <span className="text-muted-foreground text-xs leading-snug">
                Runs as soon as it is created.
              </span>
            </div>
            <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
          </RadioGroupCard>

          {/* Not shipped. `Ribbon` says so ON the control and disables it, instead of a
              hand-rolled wrapper and a `disabled` prop that leaves the reason unsaid. */}
          <div className="relative">
            <RadioGroupCard className="items-start" disabled value="scheduled">
              <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <RadioGroupText>Scheduled</RadioGroupText>
                <span className="text-muted-foreground text-xs leading-snug">
                  Runs on a cron you define.
                </span>
              </div>
              <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
            </RadioGroupCard>
            <Float className="-end-2 -top-2" placement="top-end">
              <Badge size="xs" variant="secondary">Coming soon</Badge>
            </Float>
          </div>
        </RadioGroup>
      </Setting>

      <Separator />

      <Setting
        description="Only writable connections can hold output. The job gets its own folder under the one you pick."
        title="Destination"
      >
        <Field>
          <Select
            collection={destinations}
            onValueChange={(d) => set("destinationId", d.value[0] ?? null)}
            value={values.destinationId ? [values.destinationId] : []}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Where the generated graph lands…" />
            </SelectTrigger>
            <SelectContent>
              {destinations.items.map((item) => (
                <SelectItem item={item} key={item.value}>
                  <span className="font-mono">{item.label}</span>
                  <span className="ms-2 text-muted-foreground text-xs">{item.url}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* The resolved path, not a description of it. A settings page that tells you the
              rule and leaves you to apply it is making you do arithmetic. */}
          <FieldDescription>
            <Show
              fallback={<span className="text-destructive">Pick one before creating the job.</span>}
              when={!!destination}
            >
              Writes to{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {destination?.url}/{slug}
              </code>
            </Show>
          </FieldDescription>
        </Field>
      </Setting>

      <Separator />

      <Setting
        description={`Publishes a DCAT-AP record for ${ORGANISATION.legalName} alongside the graph, so the datasets are discoverable in a catalogue.`}
        title="Catalogue"
      >
        <Field orientation="horizontal">
          <FieldLabel className="w-fit flex-1">Publish a DCAT-AP record</FieldLabel>
          <Switch checked={values.dcat} onCheckedChange={(d) => set("dcat", d.checked)} />
        </Field>
      </Setting>
    </div>
  );
}

// ── The summary aside ─────────────────────────────────────────────────────────

const SEVERITY_TEXT = {
  error: "text-destructive dark:text-destructive-foreground",
  warning: "text-warning",
  info: "text-info",
} as const;

/**
 * What the job will PRODUCE.
 *
 * This page used to restate the form: name, run mode, destination, DCAT, sources — three of which
 * you had just typed on the page before, and one of which is in the title bar. A review step that
 * re-reads its own inputs is a receipt, not a review. metadata-form's third column shows the
 * generated Turtle and JSON-LD for exactly this reason: the value is in what came OUT.
 *
 * So it reads the program's mappings and shows the shape of the graph — each class, the source it
 * is minted from, the subject template, and every predicate with where its value comes from. That
 * is the question you actually have before pressing Create: is this going to emit what I think.
 */
export function SummaryPage({
  name,
  values,
  findings,
  program,
  blocked,
  creating,
  onCreate,
}: {
  name: string;
  values: ConfigValues;
  findings: Finding[];
  program: string;
  blocked: boolean;
  creating: boolean;
  onCreate: () => void;
}) {
  const destination = DESTINATIONS.find((c) => c.id === values.destinationId);
  const mappings = mappingsIn(program);
  const predicates = mappings.reduce((n, m) => n + m.properties.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold text-lg">The graph this will emit</h2>
        <p className="text-muted-foreground text-sm">
          {mappings.length} class{mappings.length === 1 ? "" : "es"} · {predicates} predicate
          {predicates === 1 ? "" : "s"} · landing in{" "}
          <Show fallback={<span className="text-destructive">no destination</span>} when={!!destination}>
            <span className="font-mono">@{destination?.name}</span>
          </Show>
        </p>
      </div>

      <Show
        fallback={
          <Item className="mx-auto max-w-[420px] flex-col gap-2 py-8 text-center">
            <ItemMedia
              className="group-has-data-[slot=item-description]/item:self-center text-muted-foreground [&_svg:not([class*='size-'])]:size-8"
              variant="icon"
            >
              <ShapesIcon />
            </ItemMedia>
            <ItemTitle className="text-base">This program emits nothing yet</ItemTitle>
            <ItemDescription>A mapping is a class, a source and the predicates it emits. Write one on the Editor page and it shows up here.</ItemDescription>
          </Item>
        }
        when={mappings.length > 0}
      >
        <div className="flex flex-col gap-4">
          {mappings.map((m) => (
            <Card key={m.name}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {m.name}
                  <Badge size="xs" variant="secondary">
                    <span className="font-mono">{m.type}</span>
                  </Badge>
                  <span className="font-normal text-muted-foreground text-xs">
                    from <span className="font-mono">{m.source ?? m.binding}</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Show when={!!m.subject}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="shrink-0 text-muted-foreground text-xs">subject</span>
                    <code className="min-w-0 truncate font-mono text-xs">{m.subject}</code>
                  </div>
                </Show>

                <Show
                  fallback={
                    <p className="text-warning text-sm">
                      No properties — this mapping emits a subject and nothing else.
                    </p>
                  }
                  when={m.properties.length > 0}
                >
                  <ul className="flex flex-col">
                    {m.properties.map((prop, i) => (
                      <li key={prop.predicate}>
                        <Show when={i > 0}>
                          <Separator />
                        </Show>
                        <div className="flex items-baseline justify-between gap-3 py-1.5">
                          <span className="font-mono text-sm">{prop.predicate}</span>
                          <code className="min-w-0 truncate font-mono text-muted-foreground text-xs">
                            {prop.value}
                          </code>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Show>
              </CardContent>
            </Card>
          ))}
        </div>
      </Show>

      <Show when={findings.length > 0}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Findings
              <Badge
                size="xs"
                variant={findings.some((f) => f.severity === "error") ? "destructive" : "warning"}
              >
                {findings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {findings.map((f, i) => (
                <li className="flex flex-col gap-0.5 rounded-lg border p-3" key={i}>
                  <span className={`font-medium text-xs ${SEVERITY_TEXT[f.severity]}`}>
                    Line {f.line} · {f.severity}
                  </span>
                  <span className="text-muted-foreground text-sm">{f.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Show>

      {/* The terminal action, with the thing it confirms. shadcn's blocks put no primary action
          in the header, and this one has a better home anyway: right under what it will create,
          gated by the same analysis the strip reports. */}
      <div className="flex items-center justify-end gap-3">
        <Show when={blocked}>
          <span className="text-muted-foreground text-sm">
            Fix the program before creating the job.
          </span>
        </Show>
        <Button disabled={blocked || creating} onClick={onCreate}>
          <Show fallback={<CheckIcon />} when={creating}>
            <Spinner />
          </Show>
          Create {name || "job"}
        </Button>
      </div>
    </div>
  );
}
