"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  Clipboard,
  ClipboardTrigger,
  cn,
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  InstanceSwitcher,
  MadeWith,
  Menu,
  MenuContent,
  MenuItem,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Preferences,
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupText,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  Ribbon,
  ScrollArea,
  Separator,
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  Show,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarUser,
  Spinner,
  Steps,
  StepsContent,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
  Toaster,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@kanzo-tech/ui";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import { EditorView } from "@codemirror/view";
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  LogOutIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  SaveIcon,
  SettingsIcon,
  UserIcon,
  WandIcon,
  XIcon,
} from "lucide-react";
// The same tenant the other showcases run on. A new screen joins the product; it does not
// invent a second company with a second set of workspaces.
import { INSTANCES, NAV, SUPPORT, USER } from "../app-shell/data";
import { slotsIn } from "./connection-slots";
import { CONNECTIONS, sleep, TEMPLATES } from "./data";
import { analyse, connectionRefs, fossil } from "./fossil-lang";
import { type ConfigValues, ConfigureForm, ConnectionsPanel, SummaryPage } from "./panels";

/** The chrome a floating cluster wears — the same utilities workspace's canvas controls use. */
const FLOATING = "rounded-lg border bg-card shadow-sm";

const STEPS = ["Editor", "Configure", "Summary"] as const;

/**
 * The job studio — keasy's "create a job" flow, rebuilt on this library.
 *
 * Three pages of one job, and `Steps` is honest about them because each one IS a page. That is
 * the difference from the draft this replaced, where the same band spanned the screen while
 * governing a single column: it promised to command the editor and did not. The rail is for what
 * ACCOMPANIES the program — the connections it can reference — so only the Editor page has one,
 * and the switcher for it sits in the status strip, exactly where workspace keeps its dock's.
 *
 * keasy's original swaps the whole screen per step too (`job-editor.tsx` returns a different tree
 * for each), but its editor is one of the things that disappears. Here the program is the page you
 * come back to, and the two after it are settings and a receipt.
 */
export function JobStudioShowcase() {
  const [mode, setMode] = useState<"studio" | "assistant" | null>(null);
  const [step, setStep] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  const [instance, setInstance] = useState(INSTANCES[0].id);

  // Opens on the two-source starter, whose second source is an empty socket — so the drag
  // target is the first thing on screen rather than something you have to go find.
  const [templateId, setTemplateId] = useState("observations");
  const [program, setProgram] = useState(TEMPLATES.find((t) => t.id === "observations")!.program);
  const [name, setName] = useState("aemet-observations");
  const [config, setConfig] = useState<ConfigValues>({
    runMode: "integrated",
    destinationId: "c-lake",
    dcat: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);

  const view = useRef<EditorView | null>(null);

  // One analysis, three readers: the lint gutter inside the editor, the badge in the chrome and
  // the gate on Create. keasy has the same split and never closed it — the LSP's diagnostics stay
  // inside the editor, so its `validating` flag is dead state (`job-editor-store.ts:64` declares
  // `setValidating`; nothing calls it) and Review advances with a red program.
  const findings = useMemo(() => analyse(program, CONNECTIONS), [program]);
  const errors = findings.filter((f) => f.severity === "error");

  // Memoised on nothing: the connection list is a module constant here, so the language
  // extension is stable and `CodeEditor` never reconfigures its compartment.
  const extensions = useMemo(() => fossil(CONNECTIONS), []);

  const usedNames = useMemo(() => new Set(connectionRefs(program).map((r) => r.name)), [program]);
  const used = CONNECTIONS.filter((c) => usedNames.has(c.name));
  const openSlots = slotsIn(program).length;
  const blocked = errors.length > 0 || !program.trim();

  const loadTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setProgram(tpl.program);
    setStep(0);
  };

  // ── Saving ──────────────────────────────────────────────────────────────────
  // A draft saves itself. The explicit control stays for the variants behind its caret, but
  // nothing hijacks ⌘S: a chord the browser owns, announced in a permanent toolbar segment, is a
  // lot of surface for "this happens anyway".

  const save = useCallback(async () => {
    setSaving(true);
    await sleep(600);
    setSaving(false);
    setSaved(true);
  }, []);

  // The dependency is the CONTENT, not the callback. On `[save]` — which `useCallback([])` makes
  // stable — this ran once at mount and never again, so the strip said "draft saved" from the
  // first second and kept saying it through every edit.
  useEffect(() => {
    setSaved(false);
    const id = setTimeout(() => void save(), 1200);
    return () => clearTimeout(id);
  }, [save, program, name, config]);

  const create = useCallback(async () => {
    if (creating || blocked) return;
    setCreating(true);
    await sleep(900);
    setCreating(false);
    toast.success({
      title: "Job created",
      description: `${name || "Unnamed job"} — ${used.length} source${used.length === 1 ? "" : "s"}`,
    });
  }, [blocked, creating, name, used.length]);

  // ── Editor commands ─────────────────────────────────────────────────────────

  /** Select a finding and bring it into view, landing it mid-pane so you arrive with context. */
  const jumpTo = (index: number) => {
    const v = view.current;
    const f = findings[index];
    if (!v || !f) return;
    setStep(0);
    v.dispatch({
      selection: { anchor: f.from, head: f.to },
      effects: EditorView.scrollIntoView(f.from, { y: "center" }),
    });
    v.focus();
  };

  /** Insert `@name/` at the caret — the rail writes into the document through `onView`. */
  const insertConnection = (connectionName: string, kind: "data" | "vocab") => {
    const v = view.current;
    if (!v) return;
    const text = kind === "vocab" ? `@${connectionName}` : `@${connectionName}/`;
    const { from, to } = v.state.selection.main;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    v.focus();
  };

  // ── How to start ────────────────────────────────────────────────────────────
  // keasy puts this on a blank screen with two bare toggle buttons. Cards carry the one thing
  // the choice actually needs: what each mode does.

  if (mode === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-background p-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-heading font-semibold text-xl">New job</h1>
          <p className="text-muted-foreground text-sm">How do you want to build it?</p>
        </div>

        <RadioGroup
          className="w-[30rem]"
          columns={2}
          onValueChange={(d) => d.value === "studio" && setMode("studio")}
        >
          <RadioGroupCard className="items-start" value="studio">
            <CodeIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <RadioGroupText>Studio</RadioGroupText>
              <span className="text-muted-foreground text-xs leading-snug">
                Write the mapping yourself, in the editor.
              </span>
            </div>
            <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
          </RadioGroupCard>

          <Ribbon disabled label="Coming soon" placement="corner">
            <RadioGroupCard className="items-start" disabled value="assistant">
              <WandIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <RadioGroupText>Assistant</RadioGroupText>
                <span className="text-muted-foreground text-xs leading-snug">
                  Describe the result and let it draft the program.
                </span>
              </div>
              <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
            </RadioGroupCard>
          </Ribbon>
        </RadioGroup>

        <MadeWith href="#" />
      </div>
    );
  }

  // ── The three pages ─────────────────────────────────────────────────────────

  const editorPane = (
    <>
      {/* `chrome={false}`: an editor PANE, not a form field — the focus ring and rounded border
          belong to a control sitting in a form, and here the region's own borders do that job.
          `basics` stays on, so the theme, history and keymap come from the library and only the
          language is ours. */}
      <CodeEditor
        basics
        chrome={false}
        className="min-h-0 flex-1"
        extensions={extensions}
        lineNumbers
        onChange={setProgram}
        onView={(v) => {
          view.current = v;
        }}
        placeholder="prefix ex: <https://example.org/>"
        value={program}
      />

      {/* Top-end, which is where an editor's own actions go: VS Code puts its editor actions at
          the top-right of the group, GitHub puts the copy button at the top-right of a code
          block. Bottom-right in an editor is where the caret position and the language live, not
          commands — workspace's cluster is there because a canvas has no top-right chrome to
          compete with, and this pane does.

          And it is only copy now. Next/previous-problem lived here too, which made the findings
          reachable from four places at once; the badge's list in the header does that job, and
          each row of it jumps to its line. */}
      <div className="absolute end-3 top-3 z-10">
        {/* Ark's machine owns the copied→check flip and its reset, so the only thing this call
            site decides is what gets copied. The part bakes in ghost + icon-sm. */}
        <Clipboard className={cn(FLOATING, "w-auto")} timeout={1200} value={program}>
          <ClipboardTrigger aria-label="Copy the program" />
        </Clipboard>
      </div>
    </>
  );

  const editorPage = (
    <Show
      fallback={<ShellMain className="relative bg-background p-0">{editorPane}</ShellMain>}
      when={railOpen}
    >
      <Resizable
        className="min-h-0"
        defaultSize={[70, 30]}
        panels={[
          { id: "editor", minSize: 40 },
          { id: "rail", minSize: 18 },
        ]}
      >
        <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id="editor">
          <ShellMain className="relative bg-background p-0">{editorPane}</ShellMain>
        </ResizablePanel>
        <ResizableResizeTrigger id="editor:rail" withHandle />
        <ResizablePanel className="flex min-h-0 min-w-0 flex-col" id="rail">
          <ShellAside aria-label="Connections" className="size-full min-h-0 border-s-0" side="end">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
              <span className="font-medium text-sm">Connections</span>
              <Badge className="ms-auto" size="xs" variant="secondary">
                {CONNECTIONS.length}
              </Badge>
            </div>
            <ConnectionsPanel
              onInsert={(c) => insertConnection(c.name, c.kind)}
              openSlots={openSlots}
              used={usedNames}
            />
          </ShellAside>
        </ResizablePanel>
      </Resizable>
    </Show>
  );

  // `StepsContent` hides the inactive steps with the `hidden` ATTRIBUTE rather than unmounting
  // them, which is why the pages can each own a `ShellMain`: the rule is one `<main>` that is not
  // hidden, not one `<main>` in the document. It also means the editor keeps its undo history and
  // its scroll position while you are two pages away, instead of being rebuilt on return.
  const pages = (
    <>
      <StepsContent className="flex min-h-0 flex-1" index={0}>
        {editorPage}
      </StepsContent>

      <StepsContent className="flex min-h-0 flex-1" index={1}>
        <ShellMain className="bg-background">
          <ConfigureForm
            jobName={name}
            onChange={(patch) => setConfig((p) => ({ ...p, ...patch }))}
            values={config}
          />
        </ShellMain>
      </StepsContent>

      <StepsContent className="flex min-h-0 flex-1" index={2}>
        <ShellMain className="bg-background">
          <SummaryPage
            blocked={blocked}
            creating={creating}
            findings={findings}
            name={name}
            onCreate={create}
            program={program}
            values={config}
          />
        </ShellMain>
      </StepsContent>
    </>
  );

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <InstanceSwitcher
            actions={[
              {
                label: "Create workspace",
                icon: <PlusIcon />,
                onSelect: () => toast.create({ title: "New workspace", type: "info" }),
              },
            ]}
            activeId={instance}
            instances={INSTANCES}
            label="Workspaces"
            onSelect={setInstance}
          />
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav items={NAV} label="Platform" />
          <SidebarNav className="mt-auto" items={SUPPORT} label="Support" />
        </SidebarContent>

        <SidebarFooter>
          <SidebarUser
            menuItems={[
              { label: "Profile", icon: <UserIcon />, onSelect: () => toast.create({ title: "Profile" }) },
              {
                label: "Settings",
                icon: <SettingsIcon />,
                onSelect: () => toast.create({ title: "Settings" }),
              },
              {
                label: "Log out",
                icon: <LogOutIcon />,
                variant: "destructive",
                separatorBefore: true,
                onSelect: () => toast.create({ title: "Logged out" }),
              },
            ]}
            user={USER}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* `Steps` wraps the whole inset because its list lives in the header and the pages it
            governs live in the body. It renders a plain div, so it takes the column classes and
            stays one element. */}
        <Steps
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
          count={STEPS.length}
          onStepChange={(d) => setStep(Math.min(d.step, STEPS.length - 1))}
          step={step}
        >
          {/* ONE row, which is what the reference does. shadcn's dashboard and sidebar blocks
              — the layout references DESIGN.md names, alongside Mantine and Ant — put a single
              `h-16` strip inside the content column holding a trigger, a separator and the trail,
              and NO primary actions: those live in the rail or in the content. This was two
              half-empty rows carrying a duplicate error count and an attribution that competes
              with the job's own name. */}
          {/* A three-column grid, so the steps sit on the header's true centre no matter how long
              the job's name is — a flex row with `ms-auto` only pushes them off the left group's
              width, which moves every time the name is edited.

              `@container`, and every threshold below is a CONTAINER query. Viewport breakpoints
              are wrong here by construction: what gets narrow is the inset, which is the viewport
              MINUS the sidebar, and `md:` cannot see the sidebar. Measured with `md:` — at a
              900px viewport with the rail open the inset is ~640px, the labels were still being
              rendered at full width, and the three groups overlapped each other on screen.

              `overflow-hidden` on the side groups is the other half: `minmax(0,1fr)` lets a column
              shrink below its content, so without it the name spilled into the steps rather than
              truncating. */}
          <ShellHeader className="@container grid h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden @2xl:gap-3">
              <SidebarTrigger />
              <Separator className="h-4" orientation="vertical" />

            {/* Composed the way the component's own example composes it. The first pass had
                `activationMode="dblclick"` and NO trigger, so a single click did nothing and
                nothing on screen said the name could be edited — it read as broken rather than
                as a control. `EditableControl` is where Ark puts the pencil, and it swaps itself
                for submit/cancel while editing. `EditablePreview` also ships `w-full px-3
                text-base` for a field-width preview, which has to be undone for a name inline in
                a strip. */}
            <Editable
              activationMode="dblclick"
              className="w-auto shrink-0"
              onValueChange={(d) => setName(d.value)}
              placeholder="Unnamed job"
              value={name}
            >
              <EditableArea className="w-auto">
                <EditableInput asChild>
                  <Input className="h-8 w-56" />
                </EditableInput>
                {/* `block` is what makes `truncate` work at all here. `EditablePreview` bakes in
                    `whitespace-pre-wrap` and inherits `inline-flex` from the button variants, and
                    `text-overflow: ellipsis` does nothing on a flex container — so the name wrapped
                    onto a second line and the header's height clipped it mid-word. Both defaults
                    are right for the multi-line preview the part was built for; a name in a strip
                    is the other case.

                    `whitespace-nowrap` is spelled out beside `truncate` on purpose: tailwind-merge
                    files them under DIFFERENT groups, so `truncate` alone never displaces the
                    baked-in `whitespace-pre-wrap` and stylesheet order decides — which it lost.
                    Naming the same group is what actually overrides it. */}
                <EditablePreview
                  className="block w-auto max-w-[8rem] truncate whitespace-nowrap px-2 py-1 font-medium @3xl:max-w-[16rem]"
                  size="sm"
                  variant="ghost"
                />
              </EditableArea>
              <EditableControl>
                <EditableEditTrigger asChild>
                  <Button aria-label="Rename job" size="icon-sm" variant="ghost">
                    <PencilIcon />
                  </Button>
                </EditableEditTrigger>
                <EditableSubmitTrigger asChild>
                  <Button aria-label="Save name" size="icon-sm" variant="ghost">
                    <CheckIcon />
                  </Button>
                </EditableSubmitTrigger>
                <EditableCancelTrigger asChild>
                  <Button aria-label="Discard the new name" size="icon-sm" variant="ghost">
                    <XIcon />
                  </Button>
                </EditableCancelTrigger>
                </EditableControl>
              </Editable>
            </div>

            {/* The middle grid column is sized, not `auto`, and the list fills it. Both matter:
                `StepsSeparator` is the connector and it GROWS to fill, so on an `auto` column —
                or a `w-auto` list — every connector measured 0px and the steps read as three
                loose chips. Bounded rather than `1fr`, or the line stretches the whole header. */}
            <StepsList className="w-auto min-w-0 @4xl:w-[24rem]">
              {STEPS.map((title, index) => (
                <StepsItem index={index} key={title}>
                  <StepsTrigger>
                    <StepsIndicator>{index + 1}</StepsIndicator>
                    {/* Below `md` the numbered indicators carry the step on their own; the
                        labels are what makes the row overflow first. */}
                    <StepsTitle className="hidden @4xl:inline">{title}</StepsTitle>
                  </StepsTrigger>
                  <StepsSeparator />
                </StepsItem>
              ))}
            </StepsList>

            {/* The only control up here, and it is secondary: the draft saves itself, so this is
                really the door to the document-level actions behind its caret. */}
            <div className="flex items-center gap-1.5 overflow-hidden justify-self-end">
            <ValidationBadge findings={findings} onJump={jumpTo} />
            <ButtonGroup aria-label="Save">
              <Button disabled={saving || creating} onClick={save} size="sm" variant="outline">
                <Show fallback={<SaveIcon />} when={saving}>
                  <Spinner />
                </Show>
                <span className="hidden @5xl:inline">Save draft</span>
              </Button>
              <ButtonGroupSeparator />
              <Menu>
                <MenuTrigger asChild>
                  <Button aria-label="More document actions" size="sm" variant="outline">
                    <ChevronDownIcon />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem
                    onSelect={() =>
                      toast.create({ title: "Saved and queued a run", type: "success" })
                    }
                    value="run"
                  >
                    Save and run now
                  </MenuItem>
                  <MenuItem
                    onSelect={() => toast.create({ title: "Duplicated as a new draft" })}
                    value="duplicate"
                  >
                    Duplicate as new job
                  </MenuItem>
                  <MenuSeparator />
                  {/* A RADIO group, not a row of commands. Which starter is loaded is state that
                      survives closing the surface, and DESIGN.md's test for that is explicit:
                      "if closing the surface leaves state, it is a listbox". Ark's menu has the
                      radio variant for exactly this, so the value keeps its checkmark. */}
                  <MenuRadioGroup
                    onValueChange={(d) => loadTemplate(d.value)}
                    value={templateId}
                  >
                    <MenuGroupLabel>Start from</MenuGroupLabel>
                    {TEMPLATES.map((t) => (
                      <MenuRadioItem key={t.id} value={t.id}>
                        {t.label}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                  <MenuSeparator />
                  <MenuItem onSelect={() => loadTemplate(templateId)} value="discard">
                    Discard changes
                  </MenuItem>
                </MenuContent>
              </Menu>
            </ButtonGroup>
            </div>
          </ShellHeader>

          <ShellBody className="min-w-0">{pages}</ShellBody>

          {/* A STATUS strip, the shape workspace closes with ("582 nodes · 1,092 edges ·
              Settling"), and the dock switcher at its trailing edge, where workspace keeps its
              own. Only the Editor page has a dock, so only the Editor page shows the icons. */}
          <ShellFooter className="h-8 flex-row items-center gap-2 px-3 text-muted-foreground text-xs">
            {/* No finding count here any more: the badge in the header owns that, and says it
                with the list behind it. This strip reports what nothing else does. */}
            <span className="truncate">
              {used.length} source{used.length === 1 ? "" : "s"}
              {openSlots > 0 ? ` · ${openSlots} empty socket${openSlots === 1 ? "" : "s"}` : ""}
              {" · "}
              {saving ? "saving…" : saved ? "draft saved" : "unsaved changes"}
            </span>

            <MadeWith className="ms-auto" href="#" />

            <Show when={step === 0}>
              <ToggleGroup
                aria-label="Panels"
                multiple={false}
                onValueChange={(d) => setRailOpen(d.value.length > 0)}
                size="sm"
                spacing={2}
                value={railOpen ? ["connections"] : []}
              >
                <ToggleGroupItem aria-label="Connections" value="connections">
                  <PlugZapIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </Show>
          </ShellFooter>
        </Steps>
      </SidebarInset>
      {/* The library's own all-in-one: a floating palette FAB pinned to the corner plus the
          drawer, instead of a labelled button competing for room in the action row. Preferences
          are a thing you reach for occasionally; they should not read as one of the screen's
          main verbs. `PreferencesPanel` carries the appearance toggle in its own header, so
          there is no second control for it anywhere. */}
      <Preferences hotkey="p" />
      <Toaster />
    </SidebarProvider>
  );
}

/**
 * The tally and what it is made of — metadata-form's control, wearing the same chrome, fed by
 * this screen's analysis instead of a SHACL report. Deliberately not extracted into the library:
 * DESIGN.md's forms decision is that products produce errors and the library only displays them,
 * and these two issue models share almost nothing — one is keyed by form field with a label, the
 * other by document offset with a line number.
 *
 * One thing it does that metadata-form's cannot: every row jumps to its line. That is why the
 * editor no longer floats next/previous-problem buttons over itself.
 */
function ValidationBadge({
  findings,
  onJump,
}: {
  findings: ReturnType<typeof analyse>;
  onJump: (index: number) => void;
}) {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  return (
    <HoverCard openDelay={80}>
      <HoverCardTrigger asChild>
        <button
          aria-label={findings.length ? "Go to the first problem" : "No problems"}
          disabled={findings.length === 0}
          onClick={() => onJump(0)}
          type="button"
        >
          <Badge size="lg" variant={errors ? "destructive" : warnings ? "warning" : "success"}>
            {errors
              ? `${errors} error${errors === 1 ? "" : "s"}`
              : warnings
                ? `${warnings} warning${warnings === 1 ? "" : "s"}`
                : "Valid"}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="font-medium text-sm">Program</p>
          <p className="text-muted-foreground text-xs">
            {findings.length ? "Click a line to go to it." : "The same analysis the gutter shows."}
          </p>
        </div>
        <Show
          fallback={
            <p className="px-3 py-3 text-sm">Every reference resolves and every mapping emits.</p>
          }
          when={findings.length > 0}
        >
          <ScrollArea className="max-h-64">
            <ul className="divide-y">
              {findings.map((f, i) => (
                <li key={i}>
                  <button
                    className="flex w-full items-start justify-between gap-3 px-3 py-1.5 text-start hover:bg-accent"
                    onClick={() => onJump(i)}
                    type="button"
                  >
                    <span className="shrink-0 font-medium text-xs">Line {f.line}</span>
                    <span className="text-end text-muted-foreground text-xs">{f.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Show>
      </HoverCardContent>
    </HoverCard>
  );
}

export default JobStudioShowcase;
