"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  DialogTrigger,
  Field,
  FieldArray,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRequiredIndicator,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Kbd,
  MadeWith,
  NativeSelect,
  NativeSelectOption,
  NumberField,
  PreferencesPanel,
  PreferencesRoot,
  ScrollArea,
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Steps,
  StepsContent,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsNext,
  StepsPrevious,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
  SuggestMenu,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TextField,
} from "@kanzo-tech/ui";
import { DateField } from "@kanzo-tech/ui";
// CompletionField is CodeMirror-backed, so it lives behind the optional-peer boundary on the
// `/editor` subpath — never the root barrel. The showcase route already imports subpaths
// (app-shell pulls `@kanzo-tech/ui/table`), so this is the established pattern.
import { CompletionField } from "@kanzo-tech/ui/editor";
import {
  CheckIcon,
  Code2Icon,
  FileTextIcon,
  Share2Icon,
  ShapesIcon,
} from "lucide-react";
import {
  ACCESS_RIGHTS,
  completeDescription,
  DATA_THEMES,
  DATASETS,
  EMPTY_DATASET,
  type Entry,
  FORMATS,
  type FormValues,
  GROUPS,
  type GroupId,
  HEALTH_CATEGORIES,
  type Issue,
  SHAPE_COUNT,
  SHAPES_TTL,
  suggestKeywords,
  toJsonLd,
  toTurtle,
  tripleCount,
  uid,
  validate,
} from "./data";

// The library models validation as a boolean + a node (DESIGN.md, FORMS-DECISION.md). So a
// VIOLATION goes through `Field`'s own channel (`invalid` + `FieldError`), while WARNING / INFO
// — severities the library deliberately does not model — are product-rendered nodes. That split
// is the whole point of the forms decision, made visible.

type Counts = { violations: number; warnings: number; infos: number };
type Layout = "cards" | "tabs" | "steps";
type EntryKey = "descriptions" | "keywords" | "themes" | "healthThemes" | "codingSystems";

const SEVERITY_TEXT: Record<Issue["severity"], string> = {
  violation: "text-destructive dark:text-destructive-foreground",
  warning: "text-warning",
  info: "text-info",
};

/** The per-field message list — the `ReactNode` the product hands to the library. Violations
 *  use the real `FieldError` part; the non-blocking severities are plain styled lines. */
function IssueLines({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <>
      {issues.map((iss, i) =>
        iss.severity === "violation" ? (
          <FieldError key={i}>{iss.message}</FieldError>
        ) : (
          <p className={cn("text-sm", SEVERITY_TEXT[iss.severity])} key={i}>
            {iss.message}
          </p>
        ),
      )}
    </>
  );
}

/** Label · description · control · messages — one field, in the design-system idiom. */
function FieldFrame({
  label,
  description,
  required,
  issues,
  action,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  issues: Issue[];
  /** A trailing control on the label row (e.g. a `SuggestMenu`). */
  action?: ReactNode;
  children: (invalid: boolean) => ReactNode;
}) {
  const invalid = issues.some((iss) => iss.severity === "violation");
  return (
    <Field className="gap-1.5" invalid={invalid}>
      <div className="flex min-h-6 items-center gap-2">
        <FieldLabel className="w-fit">
          {label}
          {required && <FieldRequiredIndicator />}
        </FieldLabel>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      {children(invalid)}
      <IssueLines issues={issues} />
    </Field>
  );
}

/** The "+ Add" affordance the real app uses as the empty state of every repeatable/compound
 *  field. Kept as the plain `secondary` button `FieldArray` itself uses, so the whole form
 *  reads as one family. */
function AddButton({ label = "Add", onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button className="w-fit gap-1.5" onClick={onClick} size="sm" variant="secondary">
      <span className="text-base leading-none">+</span>
      {label}
    </Button>
  );
}

/** The bordered inner card a compound object (Publisher, a Contact, a Distribution) expands
 *  into, with a close control top-right. */
function NestedCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-lg border bg-background p-4">
      <Button
        aria-label={`Remove ${title}`}
        className="absolute inset-e-2 top-2 text-muted-foreground opacity-64 hover:opacity-100"
        onClick={onRemove}
        size="icon-sm"
        variant="ghost"
      >
        <span aria-hidden className="text-base leading-none">
          ×
        </span>
      </Button>
      <div className="flex flex-col gap-4 pe-6">{children}</div>
    </div>
  );
}

/** A group's issue tally — a red / amber count, or a green tick when the group is clean.
 *  Shown on tab triggers, step indicators and card headers. */
function GroupBadge({ counts }: { counts: Counts }) {
  if (counts.violations)
    return (
      <Badge pill size="xs" variant="destructive">
        {counts.violations}
      </Badge>
    );
  if (counts.warnings)
    return (
      <Badge pill size="xs" variant="warning">
        {counts.warnings}
      </Badge>
    );
  if (counts.infos)
    return (
      <Badge pill size="xs" variant="info">
        {counts.infos}
      </Badge>
    );
  return <CheckIcon aria-label="No issues" className="size-3.5 text-success" />;
}

/**
 * The metadata-form showcase — a HealthDCAT-AP editor mirroring keasy's real screen: a top
 * utility strip (Shape / Data switcher / Share / Made-with), a header with Source / Output /
 * validation / Preferences, and a sequential Card-per-group form in a centred column. It is
 * MOSTLY COMPOSITION — `Field`, `FieldArray`, `DateField`, `SuggestMenu`, `CompletionField`,
 * `Steps`, `Tabs`, `NativeSelect` — over a FAKED SHACL engine that lives entirely in `data.tsx`.
 * The library displays a boolean + a node; the fixtures produce them.
 */
export function MetadataFormShowcase() {
  const [datasetId, setDatasetId] = useState("empty");
  const [values, setValues] = useState<FormValues>(EMPTY_DATASET);
  const [layout, setLayout] = useState<Layout>("cards");
  const [activeGroup, setActiveGroup] = useState<GroupId>("general");

  const report = useMemo(() => validate(values), [values]);

  const issuesByField = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const iss of report) (map[iss.field] ??= []).push(iss);
    return map;
  }, [report]);

  const countsByGroup = useMemo(() => {
    const base = Object.fromEntries(
      GROUPS.map((g) => [g.id, { violations: 0, warnings: 0, infos: 0 }]),
    ) as Record<GroupId, Counts>;
    for (const iss of report) base[iss.group][`${iss.severity}s`] += 1;
    return base;
  }, [report]);

  const violations = report.filter((iss) => iss.severity === "violation").length;
  const valid = violations === 0;
  const fieldIssues = (field: string) => issuesByField[field] ?? [];

  // ── State updates ──────────────────────────────────────────────────────────

  const loadDataset = (id: string) => {
    const ds = DATASETS.find((d) => d.id === id) ?? DATASETS[0];
    setDatasetId(ds.id);
    setValues(ds.values);
  };

  const setScalar = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((p) => ({ ...p, [key]: value }));

  const addEntry = (key: EntryKey, prefix: string) =>
    setValues((p) => ({ ...p, [key]: [...p[key], { id: uid(prefix), value: "" }] }));
  const setEntry = (key: EntryKey, i: number, value: string) =>
    setValues((p) => ({
      ...p,
      [key]: p[key].map((e: Entry, idx: number) => (idx === i ? { ...e, value } : e)),
    }));
  const removeEntry = (key: EntryKey, i: number) =>
    setValues((p) => ({ ...p, [key]: p[key].filter((_: Entry, idx: number) => idx !== i) }));

  // ── Field renderers, one per group ───────────────────────────────────────────

  function GeneralFields() {
    return (
      <>
        <FieldFrame
          description="A name given to the dataset."
          issues={fieldIssues("title")}
          label="Title"
          required
        >
          {(invalid) => (
            <TextField
              invalid={invalid}
              onChange={(e) => setScalar("title", e.target.value)}
              placeholder="e.g. COVID-19 case registry"
              value={values.title}
            />
          )}
        </FieldFrame>

        <FieldFrame
          description="A free-text account of the dataset."
          issues={fieldIssues("descriptions")}
          label="Description"
          required
        >
          {() =>
            values.descriptions.length === 0 ? (
              <AddButton onClick={() => addEntry("descriptions", "d")} />
            ) : (
              <FieldArray
                addLabel="Add"
                align="start"
                count={values.descriptions.length}
                onAdd={() => addEntry("descriptions", "d")}
                onRemove={(i) => removeEntry("descriptions", i)}
                rowKey={(i) => values.descriptions[i].id}
              >
                {(i) => (
                  <CompletionField
                    complete={completeDescription}
                    onChange={(v) => setEntry("descriptions", i, v ?? "")}
                    placeholder="Describe the dataset — press Tab to accept the suggestion…"
                    value={values.descriptions[i].value}
                  />
                )}
              </FieldArray>
            )
          }
        </FieldFrame>

        <FieldFrame
          action={
            <SuggestMenu
              existing={values.keywords.map((k) => k.value)}
              onPick={(value) =>
                setValues((p) => ({
                  ...p,
                  keywords: [...p.keywords, { id: uid("k"), value }],
                }))
              }
              suggest={suggestKeywords}
            />
          }
          description="Keywords or tags describing the dataset."
          issues={fieldIssues("keywords")}
          label="Keywords"
        >
          {() => (
            <div className="flex flex-col gap-2">
              {values.keywords.length > 0 && (
                <FieldArray
                  canAdd={false}
                  count={values.keywords.length}
                  onAdd={() => addEntry("keywords", "k")}
                  onRemove={(i) => removeEntry("keywords", i)}
                  rowKey={(i) => values.keywords[i].id}
                >
                  {(i) => (
                    <TextField
                      onChange={(e) => setEntry("keywords", i, e.target.value)}
                      placeholder="keyword"
                      value={values.keywords[i].value}
                    />
                  )}
                </FieldArray>
              )}
              <AddButton onClick={() => addEntry("keywords", "k")} />
            </div>
          )}
        </FieldFrame>

        <FieldFrame
          description="A category of the dataset (data theme)."
          issues={fieldIssues("themes")}
          label="Theme"
        >
          {() =>
            values.themes.length === 0 ? (
              <AddButton onClick={() => addEntry("themes", "t")} />
            ) : (
              <FieldArray
                count={values.themes.length}
                onAdd={() => addEntry("themes", "t")}
                onRemove={(i) => removeEntry("themes", i)}
                rowKey={(i) => values.themes[i].id}
              >
                {(i) => (
                  <NativeSelect
                    className="w-full"
                    onChange={(e) => setEntry("themes", i, e.target.value)}
                    value={values.themes[i].value}
                  >
                    {DATA_THEMES.map((o) => (
                      <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FieldArray>
            )
          }
        </FieldFrame>

        <FieldFrame
          description="Information about who can access the dataset."
          issues={fieldIssues("accessRights")}
          label="Access rights"
        >
          {() => (
            <NativeSelect
              className="w-full"
              onChange={(e) => setScalar("accessRights", e.target.value)}
              value={values.accessRights}
            >
              {ACCESS_RIGHTS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FieldFrame>
      </>
    );
  }

  function ProvenanceFields() {
    return (
      <>
        <FieldFrame issues={fieldIssues("issued")} label="Release date">
          {(invalid) => (
            <DateField
              invalid={invalid}
              onChange={(v) => setScalar("issued", v)}
              value={values.issued}
            />
          )}
        </FieldFrame>

        <FieldFrame issues={fieldIssues("modified")} label="Modification date">
          {(invalid) => (
            <DateField
              invalid={invalid}
              onChange={(v) => setScalar("modified", v)}
              value={values.modified}
            />
          )}
        </FieldFrame>

        <FieldFrame
          description="The entity responsible for making the dataset available."
          issues={fieldIssues("publisher")}
          label="Publisher"
          required
        >
          {() =>
            values.publisher === null ? (
              <AddButton
                onClick={() =>
                  setScalar("publisher", { name: "", homepage: "", email: "" })
                }
              />
            ) : (
              <NestedCard onRemove={() => setScalar("publisher", null)} title="Publisher">
                <Field>
                  <FieldLabel className="w-fit">
                    Name
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <TextField
                    onChange={(e) =>
                      setScalar("publisher", { ...values.publisher!, name: e.target.value })
                    }
                    placeholder="Organisation name"
                    value={values.publisher.name}
                  />
                </Field>
                <Field>
                  <FieldLabel className="w-fit">Homepage</FieldLabel>
                  <TextField
                    onChange={(e) =>
                      setScalar("publisher", { ...values.publisher!, homepage: e.target.value })
                    }
                    placeholder="https://"
                    value={values.publisher.homepage}
                  />
                </Field>
                <Field>
                  <FieldLabel className="w-fit">Email</FieldLabel>
                  <TextField
                    onChange={(e) =>
                      setScalar("publisher", { ...values.publisher!, email: e.target.value })
                    }
                    placeholder="name@example.org"
                    value={values.publisher.email}
                  />
                </Field>
              </NestedCard>
            )
          }
        </FieldFrame>

        <FieldFrame
          description="A contact point for enquiries about the dataset."
          issues={fieldIssues("contacts")}
          label="Contact point"
        >
          {() =>
            values.contacts.length === 0 ? (
              <AddButton
                onClick={() =>
                  setValues((p) => ({
                    ...p,
                    contacts: [...p.contacts, { id: uid("c"), fn: "", email: "" }],
                  }))
                }
              />
            ) : (
              <FieldArray
                addLabel="Add"
                align="start"
                canRemove={false}
                count={values.contacts.length}
                onAdd={() =>
                  setValues((p) => ({
                    ...p,
                    contacts: [...p.contacts, { id: uid("c"), fn: "", email: "" }],
                  }))
                }
                onRemove={() => undefined}
                rowKey={(i) => values.contacts[i].id}
              >
                {(i) => (
                  <NestedCard
                    onRemove={() =>
                      setValues((p) => ({
                        ...p,
                        contacts: p.contacts.filter((_, idx) => idx !== i),
                      }))
                    }
                    title={`Contact ${i + 1}`}
                  >
                    <Field>
                      <FieldLabel className="w-fit">Name</FieldLabel>
                      <TextField
                        onChange={(e) =>
                          setValues((p) => ({
                            ...p,
                            contacts: p.contacts.map((c, idx) =>
                              idx === i ? { ...c, fn: e.target.value } : c,
                            ),
                          }))
                        }
                        placeholder="Full name"
                        value={values.contacts[i].fn}
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="w-fit">Email</FieldLabel>
                      <TextField
                        onChange={(e) =>
                          setValues((p) => ({
                            ...p,
                            contacts: p.contacts.map((c, idx) =>
                              idx === i ? { ...c, email: e.target.value } : c,
                            ),
                          }))
                        }
                        placeholder="name@example.org"
                        value={values.contacts[i].email}
                      />
                    </Field>
                  </NestedCard>
                )}
              </FieldArray>
            )
          }
        </FieldFrame>
      </>
    );
  }

  function HealthFields() {
    return (
      <>
        <FieldFrame
          description="Health categories the dataset belongs to."
          issues={fieldIssues("healthThemes")}
          label="Health theme"
        >
          {() =>
            values.healthThemes.length === 0 ? (
              <AddButton onClick={() => addEntry("healthThemes", "h")} />
            ) : (
              <FieldArray
                count={values.healthThemes.length}
                onAdd={() => addEntry("healthThemes", "h")}
                onRemove={(i) => removeEntry("healthThemes", i)}
                rowKey={(i) => values.healthThemes[i].id}
              >
                {(i) => (
                  <NativeSelect
                    className="w-full"
                    onChange={(e) => setEntry("healthThemes", i, e.target.value)}
                    value={values.healthThemes[i].value}
                  >
                    {HEALTH_CATEGORIES.map((o) => (
                      <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FieldArray>
            )
          }
        </FieldFrame>

        <FieldFrame
          description="Description of the population covered by the dataset."
          issues={fieldIssues("populationCoverage")}
          label="Population coverage"
        >
          {() => (
            <Textarea
              onChange={(e) => setScalar("populationCoverage", e.target.value)}
              placeholder="e.g. National — all residents, all ages."
              rows={3}
              value={values.populationCoverage}
            />
          )}
        </FieldFrame>

        <FieldFrame
          description="The number of records in the dataset."
          issues={fieldIssues("numberOfRecords")}
          label="Number of records"
        >
          {(invalid) => (
            <NumberField
              invalid={invalid}
              min={0}
              onChange={(e) => setScalar("numberOfRecords", e.target.value)}
              placeholder="0"
              value={values.numberOfRecords}
            />
          )}
        </FieldFrame>

        <FieldFrame
          description="Coding systems (e.g. ICD-10) used by the dataset."
          issues={fieldIssues("codingSystems")}
          label="Coding system"
        >
          {() =>
            values.codingSystems.length === 0 ? (
              <AddButton onClick={() => addEntry("codingSystems", "cs")} />
            ) : (
              <FieldArray
                count={values.codingSystems.length}
                onAdd={() => addEntry("codingSystems", "cs")}
                onRemove={(i) => removeEntry("codingSystems", i)}
                rowKey={(i) => values.codingSystems[i].id}
              >
                {(i) => (
                  <TextField
                    onChange={(e) => setEntry("codingSystems", i, e.target.value)}
                    placeholder="http://purl.bioontology.org/ontology/ICD10"
                    value={values.codingSystems[i].value}
                  />
                )}
              </FieldArray>
            )
          }
        </FieldFrame>
      </>
    );
  }

  function DistributionFields() {
    const add = () =>
      setValues((p) => ({
        ...p,
        distributions: [
          ...p.distributions,
          { id: uid("dist"), accessURL: "", format: "", license: "" },
        ],
      }));
    return (
      <FieldFrame
        description="The accessible forms of the dataset (dcat:Distribution)."
        issues={fieldIssues("distributions")}
        label="Distributions"
      >
        {() =>
          values.distributions.length === 0 ? (
            <AddButton label="Add distribution" onClick={add} />
          ) : (
            <FieldArray
              addLabel="Add distribution"
              align="start"
              canRemove={false}
              count={values.distributions.length}
              onAdd={add}
              onRemove={() => undefined}
              rowKey={(i) => values.distributions[i].id}
            >
              {(i) => {
                const d = values.distributions[i];
                const set = (patch: Partial<(typeof values.distributions)[number]>) =>
                  setValues((p) => ({
                    ...p,
                    distributions: p.distributions.map((dd, idx) =>
                      idx === i ? { ...dd, ...patch } : dd,
                    ),
                  }));
                const urlMissing = !d.accessURL.trim();
                return (
                  <NestedCard
                    onRemove={() =>
                      setValues((p) => ({
                        ...p,
                        distributions: p.distributions.filter((_, idx) => idx !== i),
                      }))
                    }
                    title={`Distribution ${i + 1}`}
                  >
                    <Field invalid={urlMissing}>
                      <FieldLabel className="w-fit">
                        Access URL
                        <FieldRequiredIndicator />
                      </FieldLabel>
                      <TextField
                        invalid={urlMissing}
                        onChange={(e) => set({ accessURL: e.target.value })}
                        placeholder="https://…"
                        value={d.accessURL}
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="w-fit">Format</FieldLabel>
                      <NativeSelect
                        className="w-full"
                        onChange={(e) => set({ format: e.target.value })}
                        value={d.format}
                      >
                        {FORMATS.map((o) => (
                          <NativeSelectOption key={o.value} value={o.value}>
                            {o.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel className="w-fit">License</FieldLabel>
                      <TextField
                        onChange={(e) => set({ license: e.target.value })}
                        placeholder="https://creativecommons.org/licenses/by/4.0/"
                        value={d.license}
                      />
                    </Field>
                  </NestedCard>
                );
              }}
            </FieldArray>
          )
        }
      </FieldFrame>
    );
  }

  const GROUP_FIELDS: Record<GroupId, ReactNode> = {
    general: <GeneralFields />,
    provenance: <ProvenanceFields />,
    health: <HealthFields />,
    distributions: <DistributionFields />,
  };

  // ── Layout bodies ────────────────────────────────────────────────────────────

  const cardsBody = (
    <div className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <Card key={g.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{g.label}</CardTitle>
              <GroupBadge counts={countsByGroup[g.id]} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">{GROUP_FIELDS[g.id]}</CardContent>
        </Card>
      ))}
    </div>
  );

  const tabsBody = (
    <Tabs onValueChange={(d) => setActiveGroup(d.value as GroupId)} value={activeGroup}>
      <TabsList className="w-full justify-start">
        {GROUPS.map((g) => (
          <TabsTrigger key={g.id} value={g.id}>
            {g.label}
            <GroupBadge counts={countsByGroup[g.id]} />
          </TabsTrigger>
        ))}
      </TabsList>
      {GROUPS.map((g) => (
        <TabsContent key={g.id} value={g.id}>
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">{GROUP_FIELDS[g.id]}</CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );

  const activeIndex = GROUPS.findIndex((g) => g.id === activeGroup);
  const stepsBody = (
    <Steps
      count={GROUPS.length}
      onStepChange={(d) => setActiveGroup(GROUPS[Math.min(d.step, GROUPS.length - 1)]?.id ?? "general")}
      step={activeIndex}
    >
      <StepsList>
        {GROUPS.map((g, index) => (
          <StepsItem index={index} key={g.id}>
            <StepsTrigger>
              <StepsIndicator>{index + 1}</StepsIndicator>
              <StepsTitle className="flex items-center gap-1.5">
                {g.label}
                <GroupBadge counts={countsByGroup[g.id]} />
              </StepsTitle>
            </StepsTrigger>
            <StepsSeparator />
          </StepsItem>
        ))}
      </StepsList>
      {GROUPS.map((g, index) => (
        <StepsContent index={index} key={g.id}>
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">{GROUP_FIELDS[g.id]}</CardContent>
          </Card>
        </StepsContent>
      ))}
      <div className="flex justify-between gap-2">
        <StepsPrevious asChild>
          <Button size="sm" variant="outline">
            Back
          </Button>
        </StepsPrevious>
        <StepsNext asChild>
          <Button size="sm">Next</Button>
        </StepsNext>
      </div>
    </Steps>
  );

  const body = layout === "cards" ? cardsBody : layout === "tabs" ? tabsBody : stepsBody;

  // ── Chrome ───────────────────────────────────────────────────────────────────

  return (
    <ShellRoot>
      {/* Top utility strip — Shape / Data switcher / Share, with the Made-with attribution. */}
      <ShellHeader className="h-9 flex-row items-center gap-2.5 border-b px-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ShapesIcon className="size-3.5" />
          Shape
        </span>
        <NativeSelect className="w-40" defaultValue="healthdcatap" size="sm">
          <NativeSelectOption value="healthdcatap">HealthDCAT-AP</NativeSelectOption>
        </NativeSelect>
        <span className="ms-1 text-muted-foreground">Data</span>
        <NativeSelect
          className="w-48"
          onChange={(e) => loadDataset(e.target.value)}
          size="sm"
          value={datasetId}
        >
          {DATASETS.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button className="gap-1.5" size="sm" variant="ghost">
          <Share2Icon />
          Share
        </Button>
        <MadeWith className="ms-auto" href="#" />
      </ShellHeader>

      <ShellBody>
        <ShellMain className="overflow-hidden bg-background">
          {/* Header — title + Source / Output / validation / Preferences. */}
          <div className="flex shrink-0 items-center gap-4 border-b px-6 py-3">
            <div className="min-w-0">
              <h1 className="truncate font-bold font-heading text-lg">metadata-form</h1>
              <p className="truncate text-muted-foreground text-xs">
                SHACL shapes → editable RDF form → Turtle &amp; JSON-LD
              </p>
            </div>

            <div className="ms-auto flex items-center gap-1.5">
              {/* Source — the shapes graph. */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="gap-1.5" size="sm" variant="outline">
                    <FileTextIcon />
                    Source
                    <Badge size="xs" variant="secondary">
                      {SHAPE_COUNT}
                    </Badge>
                  </Button>
                </SheetTrigger>
                <SheetContent className="max-w-xl">
                  <SheetHeader>
                    <SheetTitle>SHACL source</SheetTitle>
                    <SheetDescription>
                      The shapes graph this form is generated from.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetBody className="min-h-0 flex-1 overflow-auto">
                    <pre className="rounded-lg border bg-muted/40 p-4 font-mono text-muted-foreground text-xs leading-relaxed">
                      {SHAPES_TTL}
                    </pre>
                  </SheetBody>
                </SheetContent>
              </Sheet>

              {/* Output — the live serialisation. */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="gap-1.5" size="sm" variant="outline">
                    <Code2Icon />
                    Output
                    <Badge size="xs" variant="secondary">
                      {tripleCount(values)}
                    </Badge>
                  </Button>
                </SheetTrigger>
                <SheetContent className="max-w-xl">
                  <SheetHeader>
                    <SheetTitle>Output</SheetTitle>
                    <SheetDescription>Serialised live from the form above.</SheetDescription>
                  </SheetHeader>
                  <SheetBody className="min-h-0 flex-1 overflow-auto">
                    <Tabs defaultValue="turtle">
                      <TabsList>
                        <TabsTrigger value="turtle">Turtle</TabsTrigger>
                        <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
                      </TabsList>
                      <TabsContent value="turtle">
                        <pre className="rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                          {toTurtle(values)}
                        </pre>
                      </TabsContent>
                      <TabsContent value="jsonld">
                        <pre className="rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                          {toJsonLd(values)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </SheetBody>
                </SheetContent>
              </Sheet>

              {/* Validation summary — a Badge that reveals every failing field on hover. */}
              <HoverCard openDelay={80}>
                <HoverCardTrigger asChild>
                  <Badge
                    className="cursor-default"
                    size="lg"
                    variant={valid ? "success" : "destructive"}
                  >
                    {valid ? "Valid" : `${violations} ${violations === 1 ? "issue" : "issues"}`}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0">
                  <div className="border-b px-3 py-2">
                    <p className="font-medium text-sm">Validation</p>
                    <p className="text-muted-foreground text-xs">
                      {valid
                        ? "All shape constraints are satisfied."
                        : "Fields that do not satisfy the shape."}
                    </p>
                  </div>
                  {report.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm">
                      <CheckIcon className="size-4 text-success" />
                      Ready to publish.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-64">
                      <ul className="divide-y">
                        {report.map((iss, i) => (
                          <li
                            className="flex items-start justify-between gap-3 px-3 py-1.5"
                            key={i}
                          >
                            <span className="font-medium text-xs">{iss.label}</span>
                            <span className={cn("text-end text-xs", SEVERITY_TEXT[iss.severity])}>
                              {iss.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </HoverCardContent>
              </HoverCard>

              {/* Preferences — the real panel, opened from the header, with the `P` hotkey. */}
              <PreferencesRoot hotkey="p">
                <DialogTrigger asChild>
                  <Button className="gap-1.5" size="sm" variant="ghost">
                    Preferences
                    <Kbd>P</Kbd>
                  </Button>
                </DialogTrigger>
                <PreferencesPanel />
              </PreferencesRoot>
            </div>
          </div>

          {/* Scrolling form column. */}
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-3xl px-6 py-8">
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">Layout</p>
                <SegmentGroup
                  aria-label="Form layout"
                  className="w-fit rounded-md bg-muted p-1"
                  onValueChange={(d) => setLayout(d.value as Layout)}
                  value={layout}
                >
                  {(
                    [
                      ["cards", "Cards"],
                      ["tabs", "Tabs"],
                      ["steps", "Steps"],
                    ] as const
                  ).map(([value, label]) => (
                    <SegmentGroupItem className="px-3 py-1" key={value} value={value}>
                      <SegmentGroupItemText className="font-medium text-sm">
                        {label}
                      </SegmentGroupItemText>
                    </SegmentGroupItem>
                  ))}
                </SegmentGroup>
              </div>

              {body}
            </div>
          </div>
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}

export default MetadataFormShowcase;
