"use client";

import {
  type ComponentType,
  createContext,
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
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticFrame,
  DiagnosticFrames,
  DiagnosticHeader,
  DiagnosticList,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
  Field,
  FieldArray,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
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
import {
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  SuggestList,
  SuggestMark,
  SuggestRoot,
} from "@kanzo-tech/ai";
import { JsonTreeView } from "@kanzo-tech/ui";
import {
  CheckIcon,
  Code2Icon,
  FileTextIcon,
  GalleryVerticalIcon,
  LayoutPanelTopIcon,
  ListChecksIcon,
  ListOrderedIcon,
  ScrollTextIcon,
  Share2Icon,
} from "lucide-react";
import { RULES_SOURCE } from "@/example/rules";
import {
  FindingsBadge,
  PaneHeader,
  PanelRail,
  WorkspaceColumns,
} from "../shared";
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
  LEDGER_KEYS,
  ORDER_COUNT,
  ORDERS_LABEL,
  PARTY_OPTIONS,
  REGION_OPTIONS,
  type Severity,
  completeDescription,
  suggestTitle,
  dutyOf,
  orderLine,
  suggestTags,
  toRecord,
  toWrit,
  uid,
  validate,
  writLines,
} from "./data";

// The library models validation as a boolean + a node (FORMS-DECISION.md). So a
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

/** The board's three words for how bad it is, in the library's three variants. */
const DIAGNOSTIC_VARIANT: Record<Severity, "destructive" | "warning" | "info"> = {
  violation: "destructive",
  warning: "warning",
  info: "info",
};

const SEVERITY_WORD: Record<Severity, string> = {
  violation: "Violation",
  warning: "Warning",
  info: "Note",
};

/** What the severity costs the posting — the one thing a collapsed finding cannot say, since its
 *  own message only ever describes the field. */
const SEVERITY_CONSEQUENCE: Record<Severity, string> = {
  violation: "The board will not take the posting until this is answered.",
  warning:
    "The board will take it, and the clerk will query this before it goes up.",
  info: "Nothing is wrong. It is worth knowing before a party reads it.",
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
const FormPrefsContext = createContext({
  showDescriptions: true,
  showKeys: false,
});

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

/**
 * Everything the board found, by the field it points at.
 *
 * A field used to be handed its own issues as a prop, which meant the field key was written twice
 * at every call site — once to look the issues up, once as the ledger key. A field now names
 * itself and the two lookups follow, so the messages under a control and the rows in the Findings
 * panel are two readings of one report and cannot disagree about which field an issue belongs to.
 */
const IssuesContext = createContext<Record<string, Issue[]>>({});

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
        )
      )}
    </>
  );
}

/** Label · description · control · messages — one field, in the design-system idiom. */
function FieldFrame({
  label,
  description,
  name,
  required,
  action,
  children,
}: {
  label: string;
  description?: string;
  /**
   * The value this field edits. One name carries three things: the issues the board raised against
   * it, the ledger key "Show ledger keys" reveals, and the `data-field` a finding's frame jumps to.
   */
  name: keyof FormValues;
  required?: boolean;
  /** A trailing control on the label row (e.g. the ✨ `SuggestMark`). */
  action?: ReactNode;
  children: (invalid: boolean) => ReactNode;
}) {
  const { showDescriptions, showKeys } = useContext(FormPrefsContext);
  const { revealAll, generation } = useContext(RevealContext);
  const issues = useContext(IssuesContext)[name] ?? [];
  const ledgerKey = LEDGER_KEYS[name];

  // The gate, and the only place it is decided. `touched` is local because the trigger is local:
  // focus leaving this field. React's `onBlur` is `focusout`, which bubbles, so one handler on the
  // `Field` covers whatever control the caller rendered inside it — no per-field wiring.
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
      // The anchor a Findings frame jumps to. Not `id`: Ark's Field consumes that one as the base
      // for the label/control/error ids it generates, so a DOM id set here would be taken away.
      data-field={name}
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
          <Show when={showKeys}>
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
function AddButton({
  label = "Add",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="w-fit gap-1.5"
      onClick={onClick}
      size="sm"
      variant="secondary"
    >
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
  tone,
  onClose,
  children,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  title: string;
  tone?: "destructive" | "info" | "success" | "warning";
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <PaneHeader
        actions={actions}
        detail={detail}
        icon={icon}
        onClose={onClose}
        title={title}
        tone={tone}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
        {children}
      </div>
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

  // Three independent docked panels: the standing orders on the leading edge, and on the trailing
  // edge the two things the posting produces — what the board would send back, and what it becomes.
  // Any of them, all of them, or none — the form takes whatever width is left.
  const [sourceOpen, setSourceOpen] = useState(false);
  // Open, and the only panel that is. A posting is written against what is wrong with it, and the
  // screen used to have nowhere to read that: the header tally counts the findings and the fields
  // carry one line each, so the sentence a board would actually send back was on no surface at all.
  const [findingsOpen, setFindingsOpen] = useState(true);
  const [output, setOutput] = useState<"record" | "writ">("record");
  const [outputOpen, setOutputOpen] = useState(false);

  // `s` / `f` / `o` toggle the three panels — bare-key hotkeys, the same convention
  // `PreferencesRoot` uses for `p` (ignored while a field is focused so typing an "s" never opens a
  // drawer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        setSourceOpen((o) => !o);
      } else if (key === "f") {
        e.preventDefault();
        setFindingsOpen((o) => !o);
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
      GROUPS.map((g) => [g.id, { violations: 0, warnings: 0, infos: 0 }])
    ) as Record<GroupId, Counts>;
    for (const iss of report) base[iss.group][`${iss.severity}s`] += 1;
    return base;
  }, [report]);

  const violations = report.filter(
    (iss) => iss.severity === "violation"
  ).length;
  const warnings = report.filter((iss) => iss.severity === "warning").length;
  const valid = violations === 0;

  // Where the last frame sent the reader. One object per press, so pressing the same frame twice
  // scrolls again, and a field and a rule are the same act seen from either side of the workspace.
  const [sent, setSent] = useState<{
    field?: keyof FormValues;
    line?: number;
  } | null>(null);

  // Which finding is open, held HERE rather than by each `Diagnostic`'s own uncontrolled state: a
  // finding's rule frame opens the Source panel, opening a panel re-keys the splitter, and the
  // re-key remounts every column — so the finding you pressed would close as you pressed it. One at
  // a time, which is also all a column this narrow can show expanded.
  const [openFinding, setOpenFinding] = useState<string | null>(null);

  useEffect(() => {
    if (!sent) return;
    const el = document.querySelector(
      sent.field ? `[data-field="${sent.field}"]` : `[data-line="${sent.line}"]`
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Scrolling moves the eye; focus moves the keyboard, and only one of them is the jump a screen
    // reader hears. `Field` renders the label and the messages around the control, so the first
    // focusable inside it is the control itself.
    el.querySelector<HTMLElement>(
      "input, select, textarea, [contenteditable]"
    )?.focus({
      preventScroll: true,
    });
  }, [sent]);

  /**
   * What a finding's own frame does: put the field on screen, with the board's objection showing.
   *
   * Three things, because a field can be hidden three ways. Tabs and Steps show one group at a
   * time, so the group is switched first; the reveal gate is opened, or the field is landed on
   * saying nothing (which is what it says while untouched, deliberately — see `RevealContext`);
   * and the scroll and focus happen in the effect above, after the group has rendered.
   */
  const sendToField = (issue: Issue) => {
    setActiveGroup(issue.group);
    setGate((g) => ({ ...g, revealAll: true }));
    setSent({ field: issue.field });
  };

  // ── State updates ──────────────────────────────────────────────────────────

  const loadContract = (id: string) => {
    const next = CONTRACTS.find((c) => c.id === id) ?? CONTRACTS[0];
    setContractId(next.id);
    setValues(next.values);
    // A different posting, so the previous one's touched fields — and its reveal — do not carry
    // over. Without this, switching to the blank sheet opens it pre-reddened.
    setGate((g) => ({ revealAll: false, generation: g.generation + 1 }));
  };

  const setScalar = <K extends keyof FormValues>(
    key: K,
    value: FormValues[K]
  ) => setValues((p) => ({ ...p, [key]: value }));

  const addEntry = (key: EntryKey, prefix: string) =>
    setValues((p) => ({
      ...p,
      [key]: [...p[key], { id: uid(prefix), value: "" }],
    }));
  const setEntry = (key: EntryKey, i: number, value: string) =>
    setValues((p) => ({
      ...p,
      [key]: p[key].map((e: Entry, idx: number) =>
        idx === i ? { ...e, value } : e
      ),
    }));
  const removeEntry = (key: EntryKey, i: number) =>
    setValues((p) => ({
      ...p,
      [key]: p[key].filter((_: Entry, idx: number) => idx !== i),
    }));

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
        label="Title"
        name="title"
        required
      >
        {(invalid) => (
          /* One line, so candidates rather than a continuation — the ✨ offers whole titles and
             the field keeps its own value. */
          <SuggestRoot
            existing={[values.title]}
            onPick={(v) => setScalar("title", v)}
            suggest={suggestTitle}
          >
            <InputGroup>
              <InputGroupInput
                aria-invalid={invalid || undefined}
                onChange={(e) => setScalar("title", e.target.value)}
                placeholder="e.g. A wyrm under the granary"
                value={values.title}
              />
              <InputGroupAddon align="inline-end">
                <SuggestMark label="Suggest a title" />
              </InputGroupAddon>
            </InputGroup>
            <SuggestList />
          </SuggestRoot>
        )}
      </FieldFrame>

      <FieldFrame
        description="What the party is walking into, in the poster's own words."
        label="Notice"
        name="notices"
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
        description="How the board is filtered. Overlapping and unordered, the way a poster types them."
        label="Tags"
        name="tags"
      >
        {(invalid) => (
          // TagsInput owns the chips + add; the ✨ writes into the same `tags` state, so the ✨ and
          // typing feed one list. No hand-rolled FieldArray.
          //
          // The ✨ used to sit on the label row, in `FieldFrame`'s `action` slot, because its
          // candidates arrived in a popover and the popover needed an anchor. They arrive under the
          // control now, so the mark moved into the control with them — which is also where the
          // other assisted field on this form has always kept it.
          <SuggestRoot
            existing={values.tags.map((t) => t.value)}
            onPick={(value) =>
              setValues((p) => ({
                ...p,
                tags: [...p.tags, { id: uid("t"), value }],
              }))
            }
            suggest={suggestTags}
          >
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
                      <TagsInputItem
                        index={index}
                        key={`${value}-${index}`}
                        value={value}
                      >
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
                <SuggestMark label="Suggest tags" />
              </TagsInputControl>
            </TagsInput>
            <SuggestList />
          </SuggestRoot>
        )}
      </FieldFrame>

      <FieldFrame
        description="What has been reported. Not every contract has something to kill."
        label="Expect"
        name="beasts"
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
        label="Region"
        name="region"
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
        label="Grade"
        name="grade"
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
      <FieldFrame label="Posted" name="posted">
        {(invalid) => (
          <IsoDateInput
            invalid={invalid}
            onChange={(v) => setScalar("posted", v)}
            value={values.posted}
          />
        )}
      </FieldFrame>

      <FieldFrame label="Due back" name="due">
        {(invalid) => (
          <IsoDateInput
            invalid={invalid}
            onChange={(v) => setScalar("due", v)}
            value={values.due}
          />
        )}
      </FieldFrame>

      <FieldFrame
        description="The hall that posts it, pays for it, and answers for it."
        label="Poster"
        name="poster"
        required
      >
        {() =>
          values.poster === null ? (
            <AddButton
              onClick={() =>
                setScalar("poster", { hall: "", handle: "", muster: "" })
              }
            />
          ) : (
            <NestedCard
              onRemove={() => setScalar("poster", null)}
              title="Poster"
            >
              <Field>
                <FieldLabel className="w-fit">
                  Hall
                  <FieldRequiredIndicator />
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  onChange={(e) =>
                    setScalar("poster", {
                      ...values.poster!,
                      hall: e.target.value,
                    })
                  }
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
                    setScalar("poster", {
                      ...values.poster!,
                      handle: e.target.value,
                    })
                  }
                  placeholder="ravenna"
                  value={values.poster.handle}
                />
              </Field>
              <Field>
                <FieldLabel className="w-fit">Muster</FieldLabel>
                <Input
                  onChange={(e) =>
                    setScalar("poster", {
                      ...values.poster!,
                      muster: e.target.value,
                    })
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
        label="Who to ask"
        name="stewards"
      >
        {() =>
          values.stewards.length === 0 ? (
            <AddButton
              onClick={() =>
                setValues((p) => ({
                  ...p,
                  stewards: [
                    ...p.stewards,
                    { id: uid("ask"), who: "", handle: "" },
                  ],
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
                  stewards: [
                    ...p.stewards,
                    { id: uid("ask"), who: "", handle: "" },
                  ],
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
                            idx === i ? { ...s, who: e.target.value } : s
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
                            idx === i ? { ...s, handle: e.target.value } : s
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
        label="Halls invited"
        name="invited"
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
        label="Orders"
        name="orders"
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
        label="Reward"
        name="reward"
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
        label="By way of"
        name="waypoints"
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
        label="Party"
        name="party"
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
                    party: p.party.map((r, idx) =>
                      idx === i ? { ...r, ...patch } : r
                    ),
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
                            ...(row.duty
                              ? {}
                              : { duty: dutyOf(e.target.value) }),
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
          <CardContent className="flex flex-col gap-5">
            {groupFields[g.id]}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const tabsBody = (
    <Tabs
      onValueChange={(d) => setActiveGroup(d.value as GroupId)}
      value={activeGroup}
    >
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
            <CardContent className="flex flex-col gap-5 pt-6">
              {groupFields[g.id]}
            </CardContent>
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
        setActiveGroup(
          GROUPS[Math.min(d.step, GROUPS.length - 1)]?.id ?? "work"
        )
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
            <CardContent className="flex flex-col gap-5 pt-6">
              {groupFields[g.id]}
            </CardContent>
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

  const body =
    layout === "cards" ? cardsBody : layout === "tabs" ? tabsBody : stepsBody;

  // ── The two docked panels ────────────────────────────────────────────────────
  // Left→right, the workspace reads exactly like the breadcrumb:
  //   the standing orders (Source)  →  the posting (Main)  →  writ & record (Output).

  // Source (leading aside) = the rules the board checks a posting against. The world's own fixture,
  // not a copy of it — `data.tsx` reads the messages under each field out of this same text.
  //
  // A line at a time rather than one text node, so a finding's rule frame has something to point
  // at. `line || "\n"` is not a flourish: an empty `display: block` span is zero pixels tall, and
  // rendering `{line}` alone closes up every blank line in the orders.
  const sourcePanel = (
    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-muted-foreground text-xs leading-relaxed">
      {RULES_SOURCE.split("\n").map((line, i) => (
        <span
          className={cn(
            "block rounded px-1",
            sent?.line === i + 1 && "bg-warning-a3 text-warning-foreground"
          )}
          data-line={i + 1}
          key={i}
        >
          {line || "\n"}
        </span>
      ))}
    </pre>
  );

  // Findings (trailing aside) = what the board would send back. The same `report` the header tally
  // counts and the fields quote, read as a list: a severity, the objection, the standing order that
  // raised it, and the positions it points at — the field on the form, and the rule in the column
  // on the opposite edge. A frame is the only thing here that crosses the workspace, which is why
  // the two documents a finding is made of sit on opposite sides of the form.
  const findingsPanel = (
    <Show
      fallback={
        <p className="text-muted-foreground text-sm">
          Nothing to answer. The board would take this posting as it stands.
        </p>
      }
      when={report.length > 0}
    >
      <DiagnosticList>
        {report.map((iss) => {
          const id = `${iss.field}:${iss.rule ?? iss.message}`;
          const line = iss.rule ? orderLine(iss.rule) : undefined;

          return (
            <Diagnostic
              key={id}
              onOpenChange={(d) => setOpenFinding(d.open ? id : null)}
              open={openFinding === id}
              variant={DIAGNOSTIC_VARIANT[iss.severity]}
            >
              {/* Severity, where, and the control on one line; the message under them, which is
                  how every compiler prints one and the only shape that survives this column. The
                  panel is 24 % of the workspace — at the width a reader actually opens it, a title
                  sharing a row with the badge and the trigger got 112 px and broke one word per
                  line. `DiagnosticHeader` wraps, so this is where it wraps — and it did not until
                  2026-08-22: this comment described the shape it wanted while the header was
                  `flex-nowrap` and the title measured 0 px here.

                  The identifier is the ledger key rather than the rule that raised it: three of
                  these findings read "This field is required.", and a collapsed row that cannot be
                  told from the two above it is a row nobody reads. The rule IS a position — it has
                  a line — so it is a frame. This is also the string "Show ledger keys" writes
                  beside the label on the form, so panel and field name the value identically. */}
              <DiagnosticHeader>
                <DiagnosticSeverity>
                  {SEVERITY_WORD[iss.severity]}
                </DiagnosticSeverity>
                <DiagnosticSource>{LEDGER_KEYS[iss.field]}</DiagnosticSource>
                <DiagnosticActions className="ms-auto">
                  {/* The chevron alone. A word beside it ("Details") was 85 px on a 310 px column
                      and pushed the trigger onto a third line of its own; the name it carried is
                      what `aria-label` is for, and it can then say which finding it opens. */}
                  <DiagnosticTrigger
                    aria-label={`What the board found on ${iss.label}`}
                  />
                </DiagnosticActions>
                <DiagnosticTitle className="basis-full">
                  {iss.message}
                </DiagnosticTitle>
              </DiagnosticHeader>
              <DiagnosticContent>
                <DiagnosticDescription>
                  {SEVERITY_CONSEQUENCE[iss.severity]}
                </DiagnosticDescription>
                <DiagnosticFrames>
                  <DiagnosticFrame
                    label={iss.label}
                    onSelect={() => sendToField(iss)}
                    path={LEDGER_KEYS[iss.field]}
                  />
                  {/* The order that objected, dimmed: it is upstream of the posting, and it is the
                      frame that explains the other one. Absent for a check we invented — a frame
                      with nowhere to go is not a button, and `DiagnosticFrame` decides that itself
                      from `onSelect`, so there is no such thing here to leave dead. */}
                  <Show when={line !== undefined}>
                    <DiagnosticFrame
                      label={iss.rule}
                      line={line}
                      onSelect={() => {
                        setSourceOpen(true);
                        setSent({ line });
                      }}
                      path="standing-orders"
                      secondary
                    />
                  </Show>
                </DiagnosticFrames>
              </DiagnosticContent>
            </Diagnostic>
          );
        })}
      </DiagnosticList>
    </Show>
  );

  // Output (trailing aside) = what the posting BECOMES, derived live from the values: the writ a
  // clerk pins to the board, and the row the board files. Raw <pre> until the read-only CodeBlock
  // lands — CodeEditor is for editing, not this view.
  // Which of the two documents the panel is showing is a question about the PANEL, so the control
  // is in the panel's header — beside the standing-orders switcher's opposite number in
  // `field-notes`, and for the same reason. It was a tab strip floating above a bordered card
  // inside the body: two frames and two paddings to say one word.
  // WHICH document this panel shows is a question about the panel, and every panel on both screens
  // answers it the same way now: a select in its own header. The shape panel switches shapes there,
  // the Source panel switches standing orders there, and this one switches between the two things
  // the form produces. It was a tab strip inside the body — a second frame, a second padding and a
  // second idiom for the one thing the three panels genuinely have in common.
  const outputPanel = (
    <div className="min-h-0 flex-1 overflow-auto">
      <Show
        fallback={
          <pre className="font-mono text-xs leading-relaxed">
            {toWrit(values)}
          </pre>
        }
        when={output === "record"}
      >
        <JsonTreeView data={JSON.parse(toRecord(values))} />
      </Show>
    </div>
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
        <div className="flex h-11 items-center gap-2.5 px-3 text-xs">
          <ScrollTextIcon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <h1 className="shrink-0 font-heading font-medium text-sm">
            Post a contract
          </h1>
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
              findings={report.map((iss) => ({
                message: iss.message,
                where: iss.label,
              }))}
              label={violations === 1 ? "issue" : "issues"}
              onToggle={() =>
                setGate((g) => ({ ...g, revealAll: !g.revealAll }))
              }
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
                      onValueChange={(d) =>
                        d.value && setLayout(d.value as Layout)
                      }
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
                    <FieldLabel className="w-fit flex-1">
                      Show field descriptions
                    </FieldLabel>
                    <Switch
                      checked={showDescriptions}
                      onCheckedChange={(d) => setShowDescriptions(d.checked)}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel className="w-fit flex-1">
                      Show ledger keys
                    </FieldLabel>
                    <Switch
                      checked={showKeys}
                      onCheckedChange={(d) => setShowKeys(d.checked)}
                    />
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
            setFindingsOpen(value.includes("findings"));
            setOutputOpen(value.includes("output"));
          }}
          panels={[
            {
              icon: FileTextIcon,
              label: "Source — the standing orders",
              value: "source",
            },
            {
              icon: ListChecksIcon,
              label: "Findings — what the board found",
              value: "findings",
            },
            {
              icon: Code2Icon,
              label: "Output — the writ and the record",
              value: "output",
            },
          ]}
          value={[
            ...(sourceOpen ? ["source"] : []),
            ...(findingsOpen ? ["findings"] : []),
            ...(outputOpen ? ["output"] : []),
          ]}
        />

        {/* A three-column workspace: the standing orders (leading) · the posting · writ & record
            (trailing), each column an independently resizable `Resizable` panel. The `<main>` is
            always the middle column; the two side columns are `<aside>` landmarks (`ShellAside
            side`). Only the open panels render, and the splitter is keyed on the open-set so Ark
            re-inits its panel model cleanly. Logical throughout — start/end, never left/right. */}
        {(() => {
          const columns: ("source" | "form" | "findings" | "output")[] = [
            ...(sourceOpen ? (["source"] as const) : []),
            "form",
            ...(findingsOpen ? (["findings"] as const) : []),
            ...(outputOpen ? (["output"] as const) : []),
          ];

          const formMain = (
            <ShellMain className="bg-background">
              <FormPrefsContext.Provider value={{ showDescriptions, showKeys }}>
                <RevealContext.Provider value={gate}>
                  <IssuesContext.Provider value={issuesByField}>
                    <div className="mx-auto w-full max-w-3xl px-6 py-8">
                      {body}
                    </div>
                  </IssuesContext.Provider>
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
                <ShellAside
                  aria-label="Source"
                  className="min-h-0 flex-1 border-e-0 bg-card"
                  side="start"
                >
                  <PanelShell
                    detail={`${ORDER_COUNT} rules`}
                    icon={FileTextIcon}
                    actions={
                      <NativeSelect
                        aria-label="Standing orders"
                        className="w-44 shrink-0"
                        defaultValue="amber"
                        size="sm"
                      >
                        <NativeSelectOption value="amber">
                          {ORDERS_LABEL}
                        </NativeSelectOption>
                      </NativeSelect>
                    }
                    onClose={() => setSourceOpen(false)}
                    title="Source"
                  >
                    {sourcePanel}
                  </PanelShell>
                </ShellAside>
              );
            if (id === "findings")
              return (
                <ShellAside
                  aria-label="Findings"
                  className="min-h-0 flex-1 border-s-0 bg-card"
                  side="end"
                >
                  <PanelShell
                    detail={
                      report.length === 0
                        ? "Nothing found"
                        : `${violations} blocking of ${report.length}`
                    }
                    icon={ListChecksIcon}
                    onClose={() => setFindingsOpen(false)}
                    title="Findings"
                    tone={
                      violations > 0
                        ? "destructive"
                        : warnings > 0
                        ? "warning"
                        : "success"
                    }
                  >
                    {findingsPanel}
                  </PanelShell>
                </ShellAside>
              );
            return (
              <ShellAside
                aria-label="Output"
                className="min-h-0 flex-1 border-s-0 bg-card"
                side="end"
              >
                <PanelShell
                  actions={
                    <NativeSelect
                      aria-label="Which output"
                      className="w-32 shrink-0"
                      onChange={(e) =>
                        setOutput(e.target.value as "record" | "writ")
                      }
                      size="sm"
                      value={output}
                    >
                      <NativeSelectOption value="record">
                        Record
                      </NativeSelectOption>
                      <NativeSelectOption value="writ">Writ</NativeSelectOption>
                    </NativeSelect>
                  }
                  detail={`${writLines(values)} lines`}
                  icon={Code2Icon}
                  onClose={() => setOutputOpen(false)}
                  title="Output"
                >
                  {outputPanel}
                </PanelShell>
              </ShellAside>
            );
          };

          // The posting keeps what the panels do not take: 24 % each, down to a floor of 34 % with
          // all three open. Written as a sum rather than a table of splits, because there are now
          // eight open-sets and the table was already three ternaries deep at four.
          const asides = columns.length - 1;
          const mainSize = Math.max(34, 100 - asides * 24);
          const asideSize = (100 - mainSize) / asides;

          return (
            <WorkspaceColumns
              columns={columns.map((id) => ({
                id,
                minSize: id === "form" ? 34 : 16,
                node: columnNode(id),
              }))}
              defaultSize={columns.map((id) =>
                id === "form" ? mainSize : asideSize
              )}
            />
          );
        })()}
      </ShellBody>
    </ShellRoot>
  );
}

export default MetadataFormShowcase;
