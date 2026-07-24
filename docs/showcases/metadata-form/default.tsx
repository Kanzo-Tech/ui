"use client";

import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  FieldSuggest,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  Kbd,
  MadeWith,
  NativeSelect,
  NativeSelectOption,
  NumberField,
  PreferencesAccent,
  PreferencesAppearance,
  PreferencesBase,
  PreferencesDensity,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesField,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ScrollArea,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionTitle,
  SectionTitleGroup,
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
  type Suggestion,
  ShellAside,
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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  Textarea,
  TextField,
} from "@kanzo-tech/ui";
import { DateField } from "@kanzo-tech/ui";
import { JsonTreeView } from "@kanzo-tech/ui";
import {
  CheckIcon,
  Code2Icon,
  FileTextIcon,
  Share2Icon,
  ShapesIcon,
  XIcon,
} from "lucide-react";
import {
  ACCESS_RIGHTS,
  completeDescription,
  completeTitle,
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
// — severities the library deliberately does not model — are product-rendered nodes.

type Counts = { violations: number; warnings: number; infos: number };
type Layout = "cards" | "tabs" | "steps";
type EntryKey = "descriptions" | "keywords" | "themes" | "healthThemes" | "codingSystems";

const SEVERITY_TEXT: Record<Issue["severity"], string> = {
  violation: "text-destructive dark:text-destructive-foreground",
  warning: "text-warning",
  info: "text-info",
};

/** Display preferences the product owns — driven live from its own Preferences popover. */
const FormPrefsContext = createContext({ showDescriptions: true, showPredicates: false });

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
  predicate,
  required,
  issues,
  action,
  complete,
  suggest,
  existing,
  onPick,
  children,
}: {
  label: string;
  description?: string;
  /** The RDF predicate — revealed as a chip when "Show RDF predicates" is on. */
  predicate?: string;
  required?: boolean;
  issues: Issue[];
  /** A trailing control on the label row (e.g. the ✨ `FieldSuggest` popover). */
  action?: ReactNode;
  /** Inline ghost-completion source — threaded to `Field` so an `aiComplete` surface picks it up. */
  complete?: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  /** Candidate source + dedup set + router — threaded to `Field` so a `FieldSuggest` picks it up. */
  suggest?: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
  existing?: string[];
  onPick?: (value: string) => void;
  children: (invalid: boolean) => ReactNode;
}) {
  const { showDescriptions, showPredicates } = useContext(FormPrefsContext);
  const invalid = issues.some((iss) => iss.severity === "violation");
  return (
    <Field
      className="gap-1.5"
      complete={complete}
      existing={existing}
      invalid={invalid}
      onPick={onPick}
      suggest={suggest}
    >
      <div className="flex min-h-6 items-center gap-2">
        <FieldLabel className="w-fit">
          {label}
          {required && <FieldRequiredIndicator />}
          {showPredicates && predicate && (
            <code className="ms-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {predicate}
            </code>
          )}
        </FieldLabel>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {showDescriptions && description && <FieldDescription>{description}</FieldDescription>}
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

/** A group's issue tally — a red / amber / blue count, or a green tick when the group is clean.
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

/** The chrome shared by both docked asides — a titled header with a close control, over a
 *  scrolling body. */
function PanelShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-medium text-sm">{title}</span>
          <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
        </div>
        <Button
          aria-label={`Close ${title}`}
          className="ms-auto text-muted-foreground"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">{children}</div>
    </>
  );
}

/**
 * The metadata-form showcase — a HealthDCAT-AP editor built as a Workspace, exactly like the
 * discovery showcase: the Shell regions carry it. `ShellHeader` holds the utility strip, the
 * title, and the Source / Output / validation / Preferences controls. Below it a THREE-COLUMN
 * `Resizable` workspace reads left→right like the breadcrumb — SHACL **Source** (a leading
 * `ShellAside`) → the editable form (`ShellMain`, the single `<main>`) → generated **Output**
 * (a trailing `ShellAside`, Turtle & JSON-LD). Each side column toggles independently from its
 * header button and is drag-resizable; validation stays in the header badge.
 *
 * It is MOSTLY COMPOSITION — `Field` (its `complete` / `suggest` AI props), `FieldArray`,
 * `DateField`, `FieldSuggest` (the ✨ candidate menu), inline ghost completion on
 * `Input`/`Textarea` (`aiComplete`), `Steps`, `Tabs`, `NativeSelect`, `Resizable` — over a
 * FAKED SHACL engine in
 * `data.tsx`. The form's layout (Sequential / Tabs / Steps) and display prefs are chosen live in
 * the library's own `Preferences` drawer, extended here with a custom Layout section.
 */
export function MetadataFormShowcase() {
  const [datasetId, setDatasetId] = useState("empty");
  const [values, setValues] = useState<FormValues>(EMPTY_DATASET);

  // Product display preferences — chosen in the header Preferences popover, applied live.
  const [layout, setLayout] = useState<Layout>("cards");
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showPredicates, setShowPredicates] = useState(false);

  // Two independent docked panels: SHACL Source on the leading edge, serialised Output on the
  // trailing edge. Either, both, or neither — the form takes whatever width is left.
  const [sourceOpen, setSourceOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  // `s` / `o` toggle the two panels — bare-key hotkeys, the same convention `PreferencesRoot`
  // uses for `p` (ignored while a field is focused so typing an "s" never opens a drawer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        setSourceOpen((o) => !o);
      } else if (key === "o") {
        e.preventDefault();
        setOutputOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tabs / Steps share the active group so the step nav stays in sync with the tab bar.
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

  // Description is a single language-tagged literal here (a Textarea, not the CodeEditor). Empty
  // clears the entry so `nonEmpty` still reports the required-field violation.
  const setDescription = (value: string) =>
    setValues((p) => ({
      ...p,
      descriptions: value ? [{ id: p.descriptions[0]?.id ?? uid("d"), value }] : [],
    }));

  // ── Field renderers, one per group ───────────────────────────────────────────
  // These are plain functions CALLED during render (not `<Component/>` elements) so the inputs
  // they return keep their identity across keystrokes — a component boundary redefined each
  // render would remount and steal focus mid-typing.

  const generalFields = (): ReactNode => (
    <>
      <FieldFrame
        complete={completeTitle}
        description="A name given to the dataset."
        issues={fieldIssues("title")}
        label="Title"
        predicate="dct:title"
        required
      >
        {(invalid) => (
          // Inline ghost completion via the surrounding `<Field complete>` — Tab accepts, Esc
          // dismisses. The overlay ghost shows only at end-of-value; the caller stays oblivious.
          <Input
            aiComplete
            aria-invalid={invalid || undefined}
            onChange={(e) => setScalar("title", e.target.value)}
            placeholder="e.g. COVID-19 case registry"
            value={values.title}
          />
        )}
      </FieldFrame>

      <FieldFrame
        complete={completeDescription}
        description="A free-text account of the dataset."
        issues={fieldIssues("descriptions")}
        label="Description"
        predicate="dct:description"
        required
      >
        {() => (
          // Multi-line inline ghost completion via the surrounding `<Field complete>` — the
          // `aiComplete` overlay mirror wraps with the textarea; Tab accepts, Esc dismisses.
          <Textarea
            aiComplete
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dataset — press Tab to accept the suggestion…"
            value={values.descriptions[0]?.value ?? ""}
          />
        )}
      </FieldFrame>

      <FieldFrame
        action={<FieldSuggest label="Suggest keywords" title="Suggested keywords" />}
        description="Keywords or tags describing the dataset."
        existing={values.keywords.map((k) => k.value)}
        issues={fieldIssues("keywords")}
        label="Keywords"
        onPick={(value) =>
          setValues((p) => ({ ...p, keywords: [...p.keywords, { id: uid("k"), value }] }))
        }
        predicate="dcat:keyword"
        suggest={suggestKeywords}
      >
        {(invalid) => (
          // TagsInput owns the chips + add; the ✨ suggestions above write into the same
          // `keywords` state, so the ✨ and typing feed one list. No hand-rolled FieldArray.
          <TagsInput
            invalid={invalid}
            onValueChange={(d) =>
              setValues((p) => ({
                ...p,
                keywords: d.value.map((v) => ({ id: uid("k"), value: v })),
              }))
            }
            value={values.keywords.map((k) => k.value)}
          >
            <TagsInputControl>
              <TagsInputContext>
                {(api) =>
                  api.value.map((value, index) => (
                    <TagsInputItem index={index} key={`${value}-${index}`} value={value}>
                      <TagsInputItemPreview>
                        <TagsInputItemText>{value}</TagsInputItemText>
                        <TagsInputItemDeleteTrigger />
                      </TagsInputItemPreview>
                      <TagsInputItemInput />
                    </TagsInputItem>
                  ))
                }
              </TagsInputContext>
              <TagsInputInput placeholder="Add keyword…" />
            </TagsInputControl>
          </TagsInput>
        )}
      </FieldFrame>

      <FieldFrame
        description="A category of the dataset (data theme)."
        issues={fieldIssues("themes")}
        label="Theme"
        predicate="dcat:theme"
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
        predicate="dct:accessRights"
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

  const provenanceFields = (): ReactNode => (
    <>
      <FieldFrame issues={fieldIssues("issued")} label="Release date" predicate="dct:issued">
        {(invalid) => (
          <DateField invalid={invalid} onChange={(v) => setScalar("issued", v)} value={values.issued} />
        )}
      </FieldFrame>

      <FieldFrame issues={fieldIssues("modified")} label="Modification date" predicate="dct:modified">
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
        predicate="dct:publisher"
        required
      >
        {() =>
          values.publisher === null ? (
            <AddButton onClick={() => setScalar("publisher", { name: "", homepage: "", email: "" })} />
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
        predicate="dcat:contactPoint"
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

  const healthFields = (): ReactNode => (
    <>
      <FieldFrame
        description="Health categories the dataset belongs to."
        issues={fieldIssues("healthThemes")}
        label="Health theme"
        predicate="healthdcatap:healthCategory"
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
        predicate="healthdcatap:populationCoverage"
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
        predicate="healthdcatap:numberOfRecords"
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
        predicate="healthdcatap:hasCodingSystem"
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

  const distributionFields = (): ReactNode => {
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
        predicate="dcat:distribution"
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
  };

  const groupFields: Record<GroupId, ReactNode> = {
    general: generalFields(),
    provenance: provenanceFields(),
    health: healthFields(),
    distributions: distributionFields(),
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
          <CardContent className="flex flex-col gap-5">{groupFields[g.id]}</CardContent>
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
            <CardContent className="flex flex-col gap-5 pt-6">{groupFields[g.id]}</CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );

  const activeIndex = GROUPS.findIndex((g) => g.id === activeGroup);
  const stepsBody = (
    <Steps
      count={GROUPS.length}
      onStepChange={(d) =>
        setActiveGroup(GROUPS[Math.min(d.step, GROUPS.length - 1)]?.id ?? "general")
      }
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
            <CardContent className="flex flex-col gap-5 pt-6">{groupFields[g.id]}</CardContent>
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

  // ── The two docked panels ────────────────────────────────────────────────────
  // Left→right, the workspace reads exactly like the breadcrumb:
  //   SHACL shapes (Source)  →  editable form (Main)  →  Turtle & JSON-LD (Output).

  // Source (leading aside) = the SHACL shapes that DEFINE the form. Static fixture.
  const sourcePanel = (
    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-muted-foreground text-xs leading-relaxed">
      {SHAPES_TTL}
    </pre>
  );

  // Output (trailing aside) = what the form GENERATES, serialised live from the values. Raw
  // <pre> until the read-only CodeBlock lands — CodeEditor is for editing, not this view.
  const outputPanel = (
    <Tabs className="min-h-0 flex-1" defaultValue="jsonld">
      <TabsList>
        <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
        <TabsTrigger value="turtle">Turtle</TabsTrigger>
      </TabsList>
      <TabsContent value="jsonld">
        <div className="overflow-auto rounded-lg border bg-muted/40 p-3">
          <JsonTreeView data={JSON.parse(toJsonLd(values))} />
        </div>
      </TabsContent>
      <TabsContent value="turtle">
        <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {toTurtle(values)}
        </pre>
      </TabsContent>
    </Tabs>
  );

  // ── Chrome ───────────────────────────────────────────────────────────────────

  return (
    <ShellRoot>
      <ShellHeader>
        {/* Utility strip — Shape / Data switcher / Share, with the Made-with attribution. */}
        <div className="flex h-9 items-center gap-2.5 border-b px-3 text-xs">
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
        </div>

        {/* Title + Source / Output / validation / Preferences. */}
        <SectionHeader className="px-6 py-3" scale="page">
          <SectionTitleGroup>
            <SectionTitle className="font-heading" level={1} scale="page">
              metadata-form
            </SectionTitle>
            <SectionDescription className="truncate text-xs">
              SHACL shapes → editable RDF form → Turtle &amp; JSON-LD
            </SectionDescription>
          </SectionTitleGroup>

          <SectionActions className="gap-1.5">
            {/* Source — the SHACL shapes. Toggles the LEADING aside, independently. */}
            <Button
              className="gap-1.5"
              onClick={() => setSourceOpen((o) => !o)}
              size="sm"
              variant={sourceOpen ? "secondary" : "outline"}
            >
              <FileTextIcon />
              Source
              <Badge size="xs" variant="secondary">
                {SHAPE_COUNT}
              </Badge>
              <Kbd>S</Kbd>
            </Button>

            {/* Output — the generated serialisation. Toggles the TRAILING aside, independently. */}
            <Button
              className="gap-1.5"
              onClick={() => setOutputOpen((o) => !o)}
              size="sm"
              variant={outputOpen ? "secondary" : "outline"}
            >
              <Code2Icon />
              Output
              <Badge size="xs" variant="secondary">
                {tripleCount(values)}
              </Badge>
              <Kbd>O</Kbd>
            </Button>

            {/* Validation summary — a Badge that reveals every failing field on hover. */}
            <HoverCard openDelay={80}>
              <HoverCardTrigger asChild>
                <Badge className="cursor-default" size="lg" variant={valid ? "success" : "destructive"}>
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
                        <li className="flex items-start justify-between gap-3 px-3 py-1.5" key={i}>
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

            {/* Preferences — OUR `Preferences` composite, EXTENDED. `PreferencesRoot` gives the
                non-modal drawer + `P` hotkey; `PreferencesPanel` renders `{children ?? default}`,
                so passing children keeps the pinned Reset·Copy·Done footer (this IS the theme
                drawer) while leading with a custom Layout + display section. Flat exports, per the
                RSC note in the component — `Preferences.X` statics do not survive the boundary. */}
            <PreferencesRoot hotkey="p">
              <DialogTrigger asChild>
                <Button className="gap-1.5" size="sm" variant="ghost">
                  Preferences
                  <Kbd>P</Kbd>
                </Button>
              </DialogTrigger>
              <PreferencesPanel>
                <div className="flex flex-col gap-3">
                  <PreferencesField label="Layout">
                    <SegmentGroup
                      aria-label="Form layout"
                      className="w-full"
                      onValueChange={(d) => d.value && setLayout(d.value as Layout)}
                      value={layout}
                      variant="solid"
                    >
                      {(
                        [
                          ["cards", "Sequential"],
                          ["tabs", "Tabs"],
                          ["steps", "Steps"],
                        ] as const
                      ).map(([value, label]) => (
                        <SegmentGroupItem className="px-2 py-1" key={value} value={value}>
                          <SegmentGroupItemText className="font-medium text-xs">
                            {label}
                          </SegmentGroupItemText>
                        </SegmentGroupItem>
                      ))}
                    </SegmentGroup>
                  </PreferencesField>

                  <Field orientation="horizontal">
                    <FieldLabel className="w-fit flex-1">Show field descriptions</FieldLabel>
                    <Switch
                      checked={showDescriptions}
                      onCheckedChange={(d) => setShowDescriptions(d.checked)}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel className="w-fit flex-1">Show RDF predicates</FieldLabel>
                    <Switch
                      checked={showPredicates}
                      onCheckedChange={(d) => setShowPredicates(d.checked)}
                    />
                  </Field>
                </div>

                {/* The library's own theme axes, flat. */}
                <PreferencesAppearance />
                <PreferencesAccent />
                <PreferencesBase />
                <PreferencesRadius />
                <PreferencesFont />
                <PreferencesMonoFont />
                <PreferencesDensity />
              </PreferencesPanel>
            </PreferencesRoot>
          </SectionActions>
        </SectionHeader>
      </ShellHeader>

      <ShellBody>
        {/* A three-column workspace: SHACL Source (leading) · the form · Output (trailing),
            each column an independently resizable `Resizable` panel. The `<main>` is always the
            middle column; the two side columns are `<aside>` landmarks (`ShellAside side`). Only
            the open panels render, and the splitter is keyed on the open-set so Ark re-inits its
            panel model cleanly. Logical throughout — start/end, never left/right. */}
        {(() => {
          const columns: ("source" | "form" | "output")[] = [
            ...(sourceOpen ? (["source"] as const) : []),
            "form",
            ...(outputOpen ? (["output"] as const) : []),
          ];

          const formMain = (
            <ShellMain className="bg-background">
              <FormPrefsContext.Provider value={{ showDescriptions, showPredicates }}>
                <div className="mx-auto w-full max-w-3xl px-6 py-8">{body}</div>
              </FormPrefsContext.Provider>
            </ShellMain>
          );

          // No aside open → the form owns the body; no splitter needed.
          if (columns.length === 1) return formMain;

          const columnNode = (id: (typeof columns)[number]) => {
            if (id === "form") return formMain;
            if (id === "source")
              return (
                <ShellAside aria-label="Source" className="min-h-0 flex-1 border-e-0" side="start">
                  <PanelShell onClose={() => setSourceOpen(false)} subtitle="SHACL shapes" title="Source">
                    {sourcePanel}
                  </PanelShell>
                </ShellAside>
              );
            return (
              <ShellAside aria-label="Output" className="min-h-0 flex-1 border-s-0" side="end">
                <PanelShell onClose={() => setOutputOpen(false)} subtitle="Turtle & JSON-LD" title="Output">
                  {outputPanel}
                </PanelShell>
              </ShellAside>
            );
          };

          const panels = columns.map((id) => ({ id, minSize: id === "form" ? 34 : 16 }));
          const defaultSize =
            columns.length === 3
              ? [24, 52, 24]
              : columns[0] === "form"
                ? [72, 28]
                : [28, 72];

          return (
            <Resizable defaultSize={defaultSize} key={columns.join("-")} panels={panels}>
              {columns.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && (
                    <ResizableResizeTrigger id={`${columns[i - 1]}:${id}`} withHandle />
                  )}
                  <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id={id}>
                    {columnNode(id)}
                  </ResizablePanel>
                </Fragment>
              ))}
            </Resizable>
          );
        })()}
      </ShellBody>
    </ShellRoot>
  );
}

export default MetadataFormShowcase;
