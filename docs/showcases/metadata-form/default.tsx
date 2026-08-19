"use client";

import {
  type ComponentType,
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { parseDate, type DateValue } from "@internationalized/date";
import {
  Badge,
  Button,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  CompleteGhost,
  CompleteHint,
  CompleteInput,
  CompleteRoot,
  CompleteTextarea,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  Field,
  FieldArray,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
  NativeSelect,
  NativeSelectOption,
  PreferencesDensity,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesField,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  PreferencesTrigger,
  RadioGroup,
  RadioGroupCard,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
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
  SuggestContent,
  SuggestRoot,
  SuggestTrigger,
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
} from "@kanzo-tech/ui";
import { JsonTreeView } from "@kanzo-tech/ui";
import {
  CheckIcon,
  Code2Icon,
  FileTextIcon,
  GalleryVerticalIcon,
  LayoutPanelTopIcon,
  ListOrderedIcon,
  ScrollTextIcon,
  Share2Icon,
} from "lucide-react";
import { RULES_SOURCE } from "@/example/rules";
import { FindingsBadge, PaneHeader, PanelRail } from "../shared";
import {
  BEAST_OPTIONS,
  BLANK,
  CONTRACTS,
  DUTY_OPTIONS,
  type Entry,
  type FormValues,
  GRADE_OPTIONS,
  GROUPS,
  type GroupId,
  HALL_OPTIONS,
  type Issue,
  ORDER_COUNT,
  ORDERS_LABEL,
  PARTY_OPTIONS,
  REGION_OPTIONS,
  completeDescription,
  completeTitle,
  dutyOf,
  suggestTags,
  toRecord,
  toWrit,
  uid,
  validate,
  writLines,
} from "./data";

// The library models validation as a boolean + a node (DESIGN.md, FORMS-DECISION.md). So a
// VIOLATION goes through `Field`'s own channel (`invalid` + `FieldError`), while WARNING / INFO
// — severities the library deliberately does not model — are product-rendered nodes.

type Counts = { violations: number; warnings: number; infos: number };
type Layout = "cards" | "tabs" | "steps";
type EntryKey = "notices" | "tags" | "beasts" | "invited" | "waypoints";

const SEVERITY_TEXT: Record<Issue["severity"], string> = {
  violation: "text-destructive dark:text-destructive-foreground",
  warning: "text-warning",
  info: "text-info",
};

// `FormValues` keeps a date as the plain ISO string the writ and the record serialise, while
// `DatePicker` speaks `DateValue`. These two are the whole seam.
function toDateValues(iso: string | null): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDate(iso)];
  } catch {
    return [];
  }
}

function IsoDateInput({
  invalid,
  onChange,
  value,
}: {
  invalid?: boolean;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  return (
    <DatePicker
      onValueChange={(details) => onChange(details.valueAsString[0] ?? null)}
      positioning={{ placement: "bottom-end" }}
      value={toDateValues(value)}
    >
      <DatePickerInput aria-invalid={invalid || undefined} />
      <DatePickerContent>
        <CalendarView view="day">
          <CalendarViewControl>
            <CalendarPrevTrigger />
            <CalendarMonthSelect />
            <CalendarYearSelect />
            <CalendarNextTrigger />
          </CalendarViewControl>
          <CalendarTable>
            <CalendarWeekDays />
            <CalendarTableDays />
          </CalendarTable>
        </CalendarView>
      </DatePickerContent>
    </DatePicker>
  );
}

/** Display preferences the product owns — driven live from its own Preferences popover. */
const FormPrefsContext = createContext({ showDescriptions: true, showKeys: false });

/**
 * When a field is allowed to say what the board found.
 *
 * `validate` runs on every keystroke over the whole posting, so without a gate a blank sheet opens
 * with every required field already red and `aria-invalid` — the orders complaining about work the
 * user has not started. `revealAll` is the "submit" this editor never has: the point where the user
 * asks to see everything at once. `generation` bumps when the posting is replaced, so loading a
 * different contract does not inherit the previous one's touched fields.
 */
const RevealContext = createContext({ revealAll: false, generation: 0 });

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
  ledgerKey,
  required,
  issues,
  action,
  children,
}: {
  label: string;
  description?: string;
  /** The key this field writes into the board's record — revealed when "Show ledger keys" is on. */
  ledgerKey?: string;
  required?: boolean;
  issues: Issue[];
  /** A trailing control on the label row (e.g. the ✨ `Suggest` popover). */
  action?: ReactNode;
  children: (invalid: boolean) => ReactNode;
}) {
  const { showDescriptions, showKeys } = useContext(FormPrefsContext);
  const { revealAll, generation } = useContext(RevealContext);

  // The gate, and the only place it is decided. `touched` is local because the trigger is local:
  // focus leaving this field. React's `onBlur` is `focusout`, which bubbles, so one handler on the
  // `Field` covers whatever control the caller rendered inside it — no per-field wiring, and no
  // field key to keep in sync with `fieldIssues`.
  const [touched, setTouched] = useState(false);
  useEffect(() => setTouched(false), [generation]);
  const reveal = revealAll || touched;

  // Gated too, not just the message: an untouched required field that is already `aria-invalid`
  // tells a screen reader the user got something wrong before they arrived.
  const invalid = reveal && issues.some((iss) => iss.severity === "violation");
  return (
    // `required` has to reach the Field, not just the indicator: `FieldRequiredIndicator` reads it
    // from Ark's field context, so passing it only to the child rendered nothing at all — no
    // asterisk, and no `aria-required` on the control either.
    <Field
      className="gap-1.5"
      invalid={invalid}
      onBlur={() => setTouched(true)}
      required={required}
    >
      <div className="flex min-h-6 items-center gap-2">
        <FieldLabel className="w-fit">
          {label}
          <Show when={!!required}>
            <FieldRequiredIndicator />
          </Show>
          <Show when={showKeys && !!ledgerKey}>
            <code className="ms-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {ledgerKey}
            </code>
          </Show>
        </FieldLabel>
        <Show when={!!action}>
          <div className="ms-auto">{action}</div>
        </Show>
      </div>
      <Show when={showDescriptions && !!description}>
        <FieldDescription>{description}</FieldDescription>
      </Show>
      {children(invalid)}
      <Show when={reveal}>
        <IssueLines issues={issues} />
      </Show>
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

/** The bordered inner card a compound object (the Poster, a steward, a signatory) expands into,
 *  with a close control top-right. */
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
/**
 * A panel's own header, and it is `h-9` because every other header on the screen is.
 *
 * It was `h-12` with a `text-sm` title — a third row of chrome above a document, in a column that
 * is already the narrow one. `field-notes` draws the same header at `h-9`, and two showcases
 * disagreeing about the height of the same furniture is the kind of difference a reader reads as
 * meaning.
 *
 * `actions` is for a control that governs THIS panel's document — the standing-orders switcher
 * belongs against the standing orders, not in the page header beside verbs that act on the form.
 */
function PanelShell({
  actions,
  detail,
  icon,
  title,
  subtitle,
  onClose,
  children,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <PaneHeader
        actions={actions}
        detail={detail ?? subtitle}
        icon={icon}
        onClose={onClose}
        title={title}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">{children}</div>
    </>
  );
}

/**
 * The metadata-form showcase — posting a contract to the Guild board, built as a Workspace exactly
 * like the discovery showcase: the Shell regions carry it. `ShellHeader` holds the utility strip,
 * the title, and the Source / Output / validation / Preferences controls. Below it a THREE-COLUMN
 * `Resizable` workspace reads left→right like the breadcrumb — the hall's standing **orders** (a
 * leading `ShellAside`) → the editable posting (`ShellMain`, the single `<main>`) → the **writ**
 * the board would pin up and the record it would file (a trailing `ShellAside`). Each side column
 * toggles independently from its header button and is drag-resizable; validation stays in the
 * header badge.
 *
 * It is MOSTLY COMPOSITION — `Field`, `FieldArray`, `DatePicker`, the ✨ `Suggest` compound
 * (`Root`/`Trigger`/`Content`, given its own `suggest` / `existing` / `onPick`), inline ghost
 * completion via the `Complete` compound composed over a pure `Input`/`Textarea`, `Steps`, `Tabs`,
 * `NativeSelect`, `Resizable` — over a FAKED rule engine in `data.tsx`. The form's layout
 * (Sequential / Tabs / Steps) and display prefs are chosen live in the library's own `Preferences`
 * drawer, extended here with a custom Layout section.
 */
export function MetadataFormShowcase() {
  const [contractId, setContractId] = useState("new");
  const [values, setValues] = useState<FormValues>(BLANK);

  // Product display preferences — chosen in the header Preferences popover, applied live.
  const [layout, setLayout] = useState<Layout>("cards");
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showKeys, setShowKeys] = useState(false);

  // The validation gate — see `RevealContext`. One object, so the provider value below is stable
  // and a keystroke in a field does not re-render every other field through the context.
  const [gate, setGate] = useState({ revealAll: false, generation: 0 });

  // Two independent docked panels: the standing orders on the leading edge, what the posting comes
  // out as on the trailing edge. Either, both, or neither — the form takes whatever width is left.
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
  const [activeGroup, setActiveGroup] = useState<GroupId>("work");

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

  const loadContract = (id: string) => {
    const next = CONTRACTS.find((c) => c.id === id) ?? CONTRACTS[0];
    setContractId(next.id);
    setValues(next.values);
    // A different posting, so the previous one's touched fields — and its reveal — do not carry
    // over. Without this, switching to the blank sheet opens it pre-reddened.
    setGate((g) => ({ revealAll: false, generation: g.generation + 1 }));
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

  // The notice is one literal here (a Textarea, not the CodeEditor). Empty clears the entry so
  // `nonEmpty` still reports the required-field violation.
  const setNotice = (value: string) =>
    setValues((p) => ({
      ...p,
      notices: value ? [{ id: p.notices[0]?.id ?? uid("n"), value }] : [],
    }));

  // ── Field renderers, one per group ───────────────────────────────────────────
  // These are plain functions CALLED during render (not `<Component/>` elements) so the inputs
  // they return keep their identity across keystrokes — a component boundary redefined each
  // render would remount and steal focus mid-typing.

  const workFields = (): ReactNode => (
    <>
      <FieldFrame
        description="How the contract reads on the board."
        issues={fieldIssues("title")}
        label="Title"
        ledgerKey="writ:title"
        required
      >
        {(invalid) => (
          <CompleteRoot
            complete={completeTitle}
            onValueChange={(v) => setScalar("title", v)}
            value={values.title}
          >
            <CompleteInput>
              <Input
                aria-invalid={invalid || undefined}
                placeholder="e.g. A wyrm under the granary"
              />
            </CompleteInput>
            <CompleteGhost />
          </CompleteRoot>
        )}
      </FieldFrame>

      <FieldFrame
        description="What the party is walking into, in the poster's own words."
        issues={fieldIssues("notices")}
        label="Notice"
        ledgerKey="writ:notice"
        required
      >
        {() => (
          <CompleteRoot
            complete={completeDescription}
            onValueChange={setNotice}
            value={values.notices[0]?.value ?? ""}
          >
            <CompleteTextarea>
              <Textarea placeholder="Say what is happening — press Tab to accept the suggestion…" />
            </CompleteTextarea>
            <CompleteHint />
          </CompleteRoot>
        )}
      </FieldFrame>

      <FieldFrame
        action={
          <SuggestRoot
            existing={values.tags.map((t) => t.value)}
            onPick={(value) =>
              setValues((p) => ({ ...p, tags: [...p.tags, { id: uid("t"), value }] }))
            }
            suggest={suggestTags}
          >
            <SuggestTrigger label="Suggest tags" />
            <SuggestContent title="Suggested tags" />
          </SuggestRoot>
        }
        description="How the board is filtered. Overlapping and unordered, the way a poster types them."
        issues={fieldIssues("tags")}
        label="Tags"
        ledgerKey="writ:tag"
      >
        {(invalid) => (
          // TagsInput owns the chips + add; the ✨ suggestions above write into the same
          // `tags` state, so the ✨ and typing feed one list. No hand-rolled FieldArray.
          <TagsInput
            invalid={invalid}
            onValueChange={(d) =>
              setValues((p) => ({
                ...p,
                tags: d.value.map((v) => ({ id: uid("t"), value: v })),
              }))
            }
            value={values.tags.map((t) => t.value)}
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
              <TagsInputInput placeholder="Add tag…" />
            </TagsInputControl>
          </TagsInput>
        )}
      </FieldFrame>

      <FieldFrame
        description="What has been reported. Not every contract has something to kill."
        issues={fieldIssues("beasts")}
        label="Expect"
        ledgerKey="writ:beast"
      >
        {() =>
          values.beasts.length === 0 ? (
            <AddButton onClick={() => addEntry("beasts", "b")} />
          ) : (
            <FieldArray
              count={values.beasts.length}
              onAdd={() => addEntry("beasts", "b")}
              onRemove={(i) => removeEntry("beasts", i)}
              rowKey={(i) => values.beasts[i].id}
            >
              {(i) => (
                <NativeSelect
                  className="w-full"
                  onChange={(e) => setEntry("beasts", i, e.target.value)}
                  value={values.beasts[i].value}
                >
                  {BEAST_OPTIONS.map((o) => (
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
        description="Where the work is, and how far a party has to walk to reach it."
        issues={fieldIssues("region")}
        label="Region"
        ledgerKey="writ:region"
      >
        {() => (
          <NativeSelect
            className="w-full"
            onChange={(e) => setScalar("region", e.target.value)}
            value={values.region}
          >
            {REGION_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FieldFrame>

      <FieldFrame
        description="How bad it is, 1 to 5. The standing orders read this before anything else."
        issues={fieldIssues("grade")}
        label="Grade"
        ledgerKey="writ:grade"
      >
        {() => (
          <NativeSelect
            className="w-full"
            onChange={(e) => setScalar("grade", e.target.value)}
            value={values.grade}
          >
            {GRADE_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FieldFrame>
    </>
  );

  const postingFields = (): ReactNode => (
    <>
      <FieldFrame issues={fieldIssues("posted")} label="Posted" ledgerKey="writ:posted">
        {(invalid) => (
          <IsoDateInput invalid={invalid} onChange={(v) => setScalar("posted", v)} value={values.posted} />
        )}
      </FieldFrame>

      <FieldFrame issues={fieldIssues("due")} label="Due back" ledgerKey="writ:due">
        {(invalid) => (
          <IsoDateInput invalid={invalid} onChange={(v) => setScalar("due", v)} value={values.due} />
        )}
      </FieldFrame>

      <FieldFrame
        description="The hall that posts it, pays for it, and answers for it."
        issues={fieldIssues("poster")}
        label="Poster"
        ledgerKey="writ:poster"
        required
      >
        {() =>
          values.poster === null ? (
            <AddButton onClick={() => setScalar("poster", { hall: "", handle: "", muster: "" })} />
          ) : (
            <NestedCard onRemove={() => setScalar("poster", null)} title="Poster">
              <Field>
                <FieldLabel className="w-fit">
                  Hall
                  <FieldRequiredIndicator />
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  onChange={(e) => setScalar("poster", { ...values.poster!, hall: e.target.value })}
                  value={values.poster.hall}
                >
                  {HALL_OPTIONS.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel className="w-fit">Signs for it</FieldLabel>
                <Input
                  onChange={(e) =>
                    setScalar("poster", { ...values.poster!, handle: e.target.value })
                  }
                  placeholder="ravenna"
                  value={values.poster.handle}
                />
              </Field>
              <Field>
                <FieldLabel className="w-fit">Muster</FieldLabel>
                <Input
                  onChange={(e) =>
                    setScalar("poster", { ...values.poster!, muster: e.target.value })
                  }
                  placeholder="Where the party reports"
                  value={values.poster.muster}
                />
              </Field>
            </NestedCard>
          )
        }
      </FieldFrame>

      <FieldFrame
        description="Who to ask on arrival — an archivist has read it before anyone signs."
        issues={fieldIssues("stewards")}
        label="Who to ask"
        ledgerKey="writ:ask"
      >
        {() =>
          values.stewards.length === 0 ? (
            <AddButton
              onClick={() =>
                setValues((p) => ({
                  ...p,
                  stewards: [...p.stewards, { id: uid("ask"), who: "", handle: "" }],
                }))
              }
            />
          ) : (
            <FieldArray
              addLabel="Add"
              align="start"
              canRemove={false}
              count={values.stewards.length}
              onAdd={() =>
                setValues((p) => ({
                  ...p,
                  stewards: [...p.stewards, { id: uid("ask"), who: "", handle: "" }],
                }))
              }
              onRemove={() => undefined}
              rowKey={(i) => values.stewards[i].id}
            >
              {(i) => (
                <NestedCard
                  onRemove={() =>
                    setValues((p) => ({
                      ...p,
                      stewards: p.stewards.filter((_, idx) => idx !== i),
                    }))
                  }
                  title={`Steward ${i + 1}`}
                >
                  <Field>
                    <FieldLabel className="w-fit">Name</FieldLabel>
                    <Input
                      onChange={(e) =>
                        setValues((p) => ({
                          ...p,
                          stewards: p.stewards.map((s, idx) =>
                            idx === i ? { ...s, who: e.target.value } : s,
                          ),
                        }))
                      }
                      placeholder="Full name"
                      value={values.stewards[i].who}
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="w-fit">Handle</FieldLabel>
                    <Input
                      onChange={(e) =>
                        setValues((p) => ({
                          ...p,
                          stewards: p.stewards.map((s, idx) =>
                            idx === i ? { ...s, handle: e.target.value } : s,
                          ),
                        }))
                      }
                      placeholder="vault"
                      value={values.stewards[i].handle}
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

  const termsFields = (): ReactNode => (
    <>
      <FieldFrame
        description="Which other halls may claim it. Left empty, only the poster's own may."
        issues={fieldIssues("invited")}
        label="Halls invited"
        ledgerKey="writ:invited"
      >
        {() =>
          values.invited.length === 0 ? (
            <AddButton onClick={() => addEntry("invited", "inv")} />
          ) : (
            <FieldArray
              count={values.invited.length}
              onAdd={() => addEntry("invited", "inv")}
              onRemove={(i) => removeEntry("invited", i)}
              rowKey={(i) => values.invited[i].id}
            >
              {(i) => (
                <NativeSelect
                  className="w-full"
                  onChange={(e) => setEntry("invited", i, e.target.value)}
                  value={values.invited[i].value}
                >
                  {HALL_OPTIONS.map((o) => (
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
        description="Conditions the party is held to, over and above the hall's standing orders."
        issues={fieldIssues("orders")}
        label="Orders"
        ledgerKey="writ:orders"
      >
        {() => (
          <Textarea
            onChange={(e) => setScalar("orders", e.target.value)}
            placeholder="e.g. Do not take the quarry track in daylight."
            rows={3}
            value={values.orders}
          />
        )}
      </FieldFrame>

      <FieldFrame
        description="Gold, on delivery. Grade sets the floor; distance sets the rest."
        issues={fieldIssues("reward")}
        label="Reward"
        ledgerKey="writ:reward"
      >
        {(invalid) => (
          <Input
            aria-invalid={invalid || undefined}
            inputMode="decimal"
            type="number"
            min={0}
            onChange={(e) => setScalar("reward", e.target.value)}
            placeholder="0"
            value={values.reward}
          />
        )}
      </FieldFrame>

      <FieldFrame
        description="Where the party is expected to pass, in order."
        issues={fieldIssues("waypoints")}
        label="By way of"
        ledgerKey="writ:waypoint"
      >
        {() =>
          values.waypoints.length === 0 ? (
            <AddButton onClick={() => addEntry("waypoints", "way")} />
          ) : (
            <FieldArray
              count={values.waypoints.length}
              onAdd={() => addEntry("waypoints", "way")}
              onRemove={(i) => removeEntry("waypoints", i)}
              rowKey={(i) => values.waypoints[i].id}
            >
              {(i) => (
                <Input
                  onChange={(e) => setEntry("waypoints", i, e.target.value)}
                  placeholder="the lower ford, before dusk"
                  value={values.waypoints[i].value}
                />
              )}
            </FieldArray>
          )
        }
      </FieldFrame>
    </>
  );

  const partyFields = (): ReactNode => {
    const add = () =>
      setValues((p) => ({
        ...p,
        party: [...p.party, { id: uid("p"), member: "", duty: "", terms: "" }],
      }));
    return (
      <FieldFrame
        description="Who signs. The standing orders count these, and read the duty each is signed for."
        issues={fieldIssues("party")}
        label="Party"
        ledgerKey="writ:party"
      >
        {() =>
          values.party.length === 0 ? (
            <AddButton label="Add a name" onClick={add} />
          ) : (
            <FieldArray
              addLabel="Add a name"
              align="start"
              canRemove={false}
              count={values.party.length}
              onAdd={add}
              onRemove={() => undefined}
              rowKey={(i) => values.party[i].id}
            >
              {(i) => {
                const row = values.party[i];
                const set = (patch: Partial<(typeof values.party)[number]>) =>
                  setValues((p) => ({
                    ...p,
                    party: p.party.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
                  }));
                const unnamed = !row.member;
                return (
                  <NestedCard
                    onRemove={() =>
                      setValues((p) => ({
                        ...p,
                        party: p.party.filter((_, idx) => idx !== i),
                      }))
                    }
                    title={`Signatory ${i + 1}`}
                  >
                    <Field invalid={unnamed}>
                      <FieldLabel className="w-fit">
                        Member
                        <FieldRequiredIndicator />
                      </FieldLabel>
                      <NativeSelect
                        className="w-full"
                        invalid={unnamed}
                        // Picking a name fills the duty from the roster, and leaves it editable: a
                        // hall may sign a scout to hold a line, and the orders read what the
                        // contract claims. Only an empty duty is filled, so an override survives.
                        onChange={(e) =>
                          set({
                            member: e.target.value,
                            ...(row.duty ? {} : { duty: dutyOf(e.target.value) }),
                          })
                        }
                        value={row.member}
                      >
                        {PARTY_OPTIONS.map((o) => (
                          <NativeSelectOption key={o.value} value={o.value}>
                            {o.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel className="w-fit">Signed for</FieldLabel>
                      <NativeSelect
                        className="w-full"
                        onChange={(e) => set({ duty: e.target.value })}
                        value={row.duty}
                      >
                        {DUTY_OPTIONS.map((o) => (
                          <NativeSelectOption key={o.value} value={o.value}>
                            {o.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel className="w-fit">Terms</FieldLabel>
                      <Input
                        onChange={(e) => set({ terms: e.target.value })}
                        placeholder="half on signing, half on return"
                        value={row.terms}
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
    work: workFields(),
    posting: postingFields(),
    terms: termsFields(),
    party: partyFields(),
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
      onStepChange={(d) => setActiveGroup(GROUPS[Math.min(d.step, GROUPS.length - 1)]?.id ?? "work")}
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
  //   the standing orders (Source)  →  the posting (Main)  →  writ & record (Output).

  // Source (leading aside) = the rules the board checks a posting against. The world's own fixture,
  // not a copy of it — `data.tsx` reads the messages under each field out of this same text.
  const sourcePanel = (
    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-muted-foreground text-xs leading-relaxed">
      {RULES_SOURCE}
    </pre>
  );

  // Output (trailing aside) = what the posting BECOMES, derived live from the values: the writ a
  // clerk pins to the board, and the row the board files. Raw <pre> until the read-only CodeBlock
  // lands — CodeEditor is for editing, not this view.
  // Which of the two documents the panel is showing is a question about the PANEL, so the control
  // is in the panel's header — beside the standing-orders switcher's opposite number in
  // `field-notes`, and for the same reason. It was a tab strip floating above a bordered card
  // inside the body: two frames and two paddings to say one word.
  const outputTabs = (
    <TabsList className="h-6 shrink-0 p-0.5">
      <TabsTrigger className="h-5 px-2 text-xs" value="record">
        Record
      </TabsTrigger>
      <TabsTrigger className="h-5 px-2 text-xs" value="writ">
        Writ
      </TabsTrigger>
    </TabsList>
  );

  const outputPanel = (
    <>
      <TabsContent className="min-h-0 flex-1 overflow-auto" value="record">
        <JsonTreeView data={JSON.parse(toRecord(values))} />
      </TabsContent>
      <TabsContent className="min-h-0 flex-1 overflow-auto" value="writ">
        <pre className="font-mono text-xs leading-relaxed">{toWrit(values)}</pre>
      </TabsContent>
    </>
  );

  // ── Chrome ───────────────────────────────────────────────────────────────────

  return (
    <ShellRoot>
      {/*
        ONE row, and it was two: a `h-9` utility strip under a `scale="page"` title, 103 px of
        chrome over a form whose own fields are `text-sm`. What a header owes is the landmark, the
        subject and the verbs — the size of the type was carrying none of it, and `field-notes`
        collapsed the same two rows for the same reason.

        The standing-orders switcher went into the Source panel's header, against the document it
        replaces. What stays here is the CONTRACT switcher, because the contract is what this page
        IS — the title and the select read as one phrase, which is what they always were.
      */}
      <ShellHeader>
        <div className="flex h-11 items-center gap-2.5 border-b px-3 text-xs">
          <ScrollTextIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-heading font-medium text-sm">Post a contract</h1>
          <NativeSelect
            aria-label="Contract"
            className="w-64 shrink-0"
            onChange={(e) => loadContract(e.target.value)}
            size="sm"
            value={contractId}
          >
            {CONTRACTS.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="hidden min-w-0 truncate text-muted-foreground 2xl:inline">
            standing orders → the posting → the writ the board pins up
          </span>

          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            <Button className="gap-1.5" size="sm" variant="ghost">
              <Share2Icon />
              Share
            </Button>
            {/* The tally, and it is `field-notes`' badge — hover lists every failing field,
                press marks them on the form. Both screens ship the same component now; the two
                had drifted into a `HoverCard` here and a plain `Badge` there. */}
            <FindingsBadge
              active={gate.revealAll}
              findings={report.map((iss) => ({ message: iss.message, where: iss.label }))}
              label={violations === 1 ? "issue" : "issues"}
              onToggle={() => setGate((g) => ({ ...g, revealAll: !g.revealAll }))}
              summary="What the board would send back."
              tone="destructive"
            />
            <Show when={valid}>
              <Badge pill size="xs" variant="success">
                Valid
              </Badge>
            </Show>

            {/* No appearance control in this header. It is one click, which is why it is not a
                panel SECTION — but `PreferencesPanel` already carries it beside its close button,
                so a button out here is the same preference reachable two ways. */}

            {/* Preferences — OUR `Preferences` composite, EXTENDED. `PreferencesRoot` gives the
                non-modal drawer + `P` hotkey; `PreferencesPanel` renders `{children ?? default}`,
                so passing children keeps the pinned Reset·Copy·Done footer (this IS the theme
                drawer) while leading with a custom Layout + display section. Flat exports, per the
                RSC note in the component — `Preferences.X` statics do not survive the boundary. */}
            <PreferencesRoot hotkey="p">
              {/* The library's own FAB — fixed bottom-end, a palette on a round surface, and the
                  same one every other showcase uses. It was a `Preferences P` button in this row:
                  a preference is not one of the screen's verbs, and standing among them it read as
                  one. The `P` hotkey is unchanged and the FAB carries it in its own title. */}
              <PreferencesTrigger />
              <PreferencesPanel>
                <div className="flex flex-col gap-3">
                  <PreferencesField label="Layout">
                    <RadioGroup
                      aria-label="Form layout"
                      className="flex-row flex-wrap gap-2"
                      onValueChange={(d) => d.value && setLayout(d.value as Layout)}
                      value={layout}
                    >
                      {(
                        [
                          ["cards", "Sequential", GalleryVerticalIcon],
                          ["tabs", "Tabs", LayoutPanelTopIcon],
                          ["steps", "Steps", ListOrderedIcon],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <RadioGroupCard
                          className="min-w-0 flex-1 basis-16 flex-col items-center gap-1.5 px-2 py-2"
                          key={value}
                          value={value}
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="font-medium text-xs">{label}</span>
                        </RadioGroupCard>
                      ))}
                    </RadioGroup>
                  </PreferencesField>

                  <Field orientation="horizontal">
                    <FieldLabel className="w-fit flex-1">Show field descriptions</FieldLabel>
                    <Switch
                      checked={showDescriptions}
                      onCheckedChange={(d) => setShowDescriptions(d.checked)}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel className="w-fit flex-1">Show ledger keys</FieldLabel>
                    <Switch checked={showKeys} onCheckedChange={(d) => setShowKeys(d.checked)} />
                  </Field>
                </div>

                {/* The library's own preference axes, flat — the canonical four, in panel order.
                    Appearance is not among them: it has one control, the toggle in the header. */}
                <PreferencesDensity />
                <PreferencesRadius />
                <PreferencesFont />
                <PreferencesMonoFont />
              </PreferencesPanel>
            </PreferencesRoot>
          </div>
        </div>
      </ShellHeader>

      <ShellBody>
        {/* Which panels are open, drawn as icons on the edge they open on — the same rail
            `field-notes` uses, and the reason the two `Source` / `Output` buttons left the header.
            A toggle that opens a region belongs against the region, not among the verbs; the
            counts they carried are in each panel's own header now. */}
        <PanelRail
          label="Panels"
          onValueChange={(value) => {
            setSourceOpen(value.includes("source"));
            setOutputOpen(value.includes("output"));
          }}
          panels={[
            { icon: FileTextIcon, label: "Source — the standing orders", value: "source" },
            { icon: Code2Icon, label: "Output — the writ and the record", value: "output" },
          ]}
          value={[...(sourceOpen ? ["source"] : []), ...(outputOpen ? ["output"] : [])]}
        />

        {/* A three-column workspace: the standing orders (leading) · the posting · writ & record
            (trailing), each column an independently resizable `Resizable` panel. The `<main>` is
            always the middle column; the two side columns are `<aside>` landmarks (`ShellAside
            side`). Only the open panels render, and the splitter is keyed on the open-set so Ark
            re-inits its panel model cleanly. Logical throughout — start/end, never left/right. */}
        {(() => {
          const columns: ("source" | "form" | "output")[] = [
            ...(sourceOpen ? (["source"] as const) : []),
            "form",
            ...(outputOpen ? (["output"] as const) : []),
          ];

          const formMain = (
            <ShellMain className="bg-background">
              <FormPrefsContext.Provider value={{ showDescriptions, showKeys }}>
                <RevealContext.Provider value={gate}>
                  <div className="mx-auto w-full max-w-3xl px-6 py-8">{body}</div>
                </RevealContext.Provider>
              </FormPrefsContext.Provider>
            </ShellMain>
          );

          // No aside open → the form owns the body; no splitter needed.
          if (columns.length === 1) return formMain;

          const columnNode = (id: (typeof columns)[number]) => {
            if (id === "form") return formMain;
            if (id === "source")
              return (
                <ShellAside aria-label="Source" className="min-h-0 flex-1 border-e-0 bg-card" side="start">
                  <PanelShell
                    detail={`${ORDER_COUNT} rules`}
                    icon={FileTextIcon}
                    actions={
                      <NativeSelect aria-label="Standing orders" className="w-44 shrink-0" defaultValue="amber" size="sm">
                        <NativeSelectOption value="amber">{ORDERS_LABEL}</NativeSelectOption>
                      </NativeSelect>
                    }
                    onClose={() => setSourceOpen(false)}
                    subtitle="the standing orders"
                    title="Source"
                  >
                    {sourcePanel}
                  </PanelShell>
                </ShellAside>
              );
            return (
              <ShellAside aria-label="Output" className="min-h-0 flex-1 border-s-0 bg-card" side="end">
                <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="record">
                  <PanelShell
                    actions={outputTabs}
                    detail={`${writLines(values)} lines`}
                    icon={Code2Icon}
                    onClose={() => setOutputOpen(false)}
                    subtitle="writ & record"
                    title="Output"
                  >
                    {outputPanel}
                  </PanelShell>
                </Tabs>
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
                  <Show when={i > 0}>
                    <ResizableResizeTrigger id={`${columns[i - 1]}:${id}`} withHandle />
                  </Show>
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
