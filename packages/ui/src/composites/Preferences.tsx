"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import {
  CORE_NAMESPACE,
  prefBoolean,
  prefNumber,
  prefOptions,
  prefShown,
  type CorePrefKey,
  type PrefOption,
  type SectionPrefDecl,
} from "@kanzo-tech/theme";
import { createListCollection } from "@ark-ui/react/collection";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";
import { useSectionContribution, type PrefSpecimen } from "../theme/section-context.js";
import { cn } from "../lib/cn.js";
import { useHotkey } from "../lib/use-hotkey.js";
import { Button } from "../simples/button.js";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../simples/field.js";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../simples/dialog.js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import { RadioGroup, RadioGroupCard } from "../simples/radio-group.js";
import { ThemePicker, type ThemePickerCopy } from "./ThemePicker.js";
import { Slider, SliderLabel } from "../simples/slider.js";
import { Switch } from "../simples/switch.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";

/**
 * Preferences — every preference a person may change, and nothing a theme owns.
 *
 * What is offered is the declaration's: `CORE_PREFS` lists the side, the theme worn on each side and
 * density, and an installed package contributes its own section. See `/docs/design/preferences`.
 *
 * **Ark's shape, for a preference.** The manifest is the data and its rules (`when`); the theme
 * provider holds the values and each section's owner says, through a `SectionProvider`, what only
 * it knows — the lists its choices name and the pictures its options wear; {@link Pref} is the part
 * and {@link usePref} its state. {@link PreferencesSections} is a composition of the part:
 *
 *   <Preferences />                          — a floating trigger and the drawer
 *   <PreferencesSections />                  — every section inline, on a settings page
 *   <PreferencesSections namespace="graph" /> — one section
 *   <Pref name="theme.density" />            — one preference, where a page puts it
 *
 * There is no per-axis export, so a host cannot mount a control for a value the theme owns. The
 * theme is the one control the generic arms cannot draw — two cards, each a live miniature of a
 * theme — so the side and the theme per side are drawn by {@link ThemePicker}, internal here.
 */

// ── Root: Ark Dialog (non-modal, live-preview) + hotkey ──────────────────────
export interface PreferencesRootProps {
  children: React.ReactNode;
  /**
   * Key that toggles the panel — `"t"`, or `"mod+,"` for ⌘, / Ctrl+,. **Opt-in — there is no default.**
   *
   * The same grammar and the same listener as `CommandDialog`'s: a key pressed while typing in a
   * field is the field's. A design system must not claim a key in its host's global keymap
   * without being asked, so omit this unless the host has decided that key is free.
   */
  hotkey?: string;
  defaultOpen?: boolean;
}

function PreferencesRoot({ children, hotkey, defaultOpen = false }: PreferencesRootProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  useHotkey(hotkey, () => setOpen((o) => !o));

  // Non-modal so the app stays interactive and re-skins live behind the panel — no backdrop, no
  // scroll lock, no focus trap. But it still closes on an outside click, because that is what a
  // panel is expected to do and the alternative surprises people far more often than it helps.
  //
  // It used to pin `closeOnInteractOutside={false}` so you could click around the app and watch it
  // re-skin. That case survives: the hotkey reopens it where you left off, and the live preview was
  // never the reason to keep it open — every change applies on selection, not on close.
  //
  // `closeOnInteractOutside` is passed explicitly, and has to be. Zag derives its default from
  // `modal` (`closeOnInteractOutside: modal && !alertDialog` in dialog.machine.js), so a non-modal
  // dialog is non-dismissable *by default* — dropping the old explicit `false` changed nothing at
  // all. The two props look independent and are not.
  return (
    <Dialog
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      modal={false}
      closeOnInteractOutside={true}
    >
      {children}
    </Dialog>
  );
}

// ── Trigger: floating palette FAB ────────────────────────────────────────────
function PreferencesTrigger({ className }: { className?: string }) {
  return (
    <DialogTrigger asChild>
      <Button
        type="button"
        size="icon-md"
        variant="outline"
        aria-label="Theme preferences"
        // `m-0`: a fixed FAB must not inherit a parent's flow spacing (`space-y-*`).
        // `bg-card`: `outline` is transparent by design, which reads as broken once the
        // button floats over arbitrary page content — a FAB needs an opaque surface.
        //
        // The `data-state` pair is load-bearing, not decoration. The panel is `modal={false}`, so
        // there is no backdrop dimming the page behind it — without an open state on the trigger,
        // nothing on screen says the panel is up. Ark's Dialog.Trigger already emits
        // `data-state="open"`, so this needs no extra state.
        //
        // Deliberately NOT a `Toggle`: `Dialog.Trigger` gives `aria-expanded` +
        // `aria-haspopup="dialog"`, which is the disclosure pattern this is. A toggle button
        // would report `aria-pressed` instead and drop the haspopup — worse semantics for a
        // control that reveals a panel. What was missing was the visual state, not the role.
        className={cn(
          "fixed end-4 bottom-4 z-40 m-0 rounded-full bg-card shadow-lg",
          "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className,
        )}
      >
        <PaletteIcon />
      </Button>
    </DialogTrigger>
  );
}

// ── Panel: non-modal drawer pinned top-right (portaled Ark Dialog content) ────
export interface PreferencesPanelProps {
  /** Replaces the default body — every offered preference — with your own sections. */
  children?: React.ReactNode;
  title?: string;
  hint?: string;
  /** The words the default body draws. */
  copy?: Partial<PreferencesCopy>;
}

function PreferencesPanel({
  children,
  title = "Preferences",
  hint = "Applied live · saved to this browser.",
  copy,
}: PreferencesPanelProps) {
  return (
    <Portal>
      <ArkDialog.Positioner className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4">
        <ArkDialog.Content
          data-slot="preferences-panel"
          className={cn(
            // `w-96`, not `w-80`. The width was chosen when the panel held four axes and a colour
            // strip; it now holds five sections plus however many the packages a host installed
            // contribute, and it is the one surface here that grows with somebody else's decision.
            // The extra 64px is what lets a palette card depict a document rather than gesture at
            // one — see `ThemePreview`.
            "pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-96 flex-col overflow-hidden",
            "rounded-lg border border-border bg-popover text-popover-foreground shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-4",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-4",
            "motion-reduce:animate-none!",
          )}
        >
          {/* Header. Nothing but the title and the close X: appearance is `ThemePicker`'s
              Light · Dark segment, and a toggle here would be a second control for it. */}
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="font-heading text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-[length:var(--kanzo-font-size-small)] text-muted-foreground">
              {hint}
            </DialogDescription>
          </div>
          <div className="absolute inset-e-3.5 top-3.5 flex items-center gap-0.5">
            <DialogClose asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Close preferences"
                className="opacity-64 hover:opacity-100"
              >
                <XIcon />
              </Button>
            </DialogClose>
          </div>

          {/* Body — scrolls independently of the pinned header/footer.
              `[&>*]:shrink-0` is load-bearing, not hygiene. This is a COLUMN flex container
              inside a `max-h`-constrained panel, so its children are flex items that default
              to `flex-shrink: 1`. Once the sections are taller than the panel, the browser
              satisfies the constraint by SQUASHING every section rather than scrolling this
              box — sections collapse to a fraction of their height, their controls overlap
              and clip, and the lower ones become unreadable. That is the "renders wrong /
              does not show all its fields" bug: the panel was never scrolling at all. */}
          <form
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 [&>*]:shrink-0"
            onSubmit={(e) => e.preventDefault()}
          >
            {children ?? <PreferencesSections copy={copy} />}
          </form>

          {/* Footer — canonical Shark actions bar: top separator + muted surface. */}
          <PreferencesFooter />
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  );
}

/** Actions bar pinned to the bottom of the panel (Reset · Done). */
function PreferencesFooter() {
  // `reset`, not `set({ ...DEFAULT_PREFS })`, which is what this was. Storage holds what a user
  // CHOSE, so spreading the defaults would write each axis explicitly — making Reset the one act
  // that pins somebody against their tenant's document. Unsetting lands wherever the chain says.
  const { reset } = useKanzoTheme();
  // No fill on the bar. The panel is `bg-popover`, and in dark `--popover` and `--muted` are the
  // same value, so a 48% muted wash composited to ΔE ~0 — the background contributed nothing and
  // the `border-t` was doing all the work. Same defect as the command, popover and dialog footers;
  // this one survived that sweep by living in `composites/`.
  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-3">
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        Reset
      </Button>
      <DialogClose asChild>
        <Button type="button" size="sm" className="ms-auto">
          Done
        </Button>
      </DialogClose>
    </div>
  );
}

// ── Section building blocks ──────────────────────────────────────────────────
/**
 * A titled preferences row. This used to be a bare `<div>` plus a hand-rolled `GroupTitle` —
 * fixed typography, no `htmlFor`, no association with the control it titled, and in the
 * segmented cases the label was written TWICE (once visibly, once as `aria-label`).
 *
 * `Field` is precisely this, wired: it generates the id, connects the label to the control and
 * carries the state by context. The forms guide says so; the library's own flagship composite
 * was the one place not taking its own advice.
 */
function PrefField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <Field>
      <FieldLabel className={PREF_HEADING}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

/**
 * ONE spelling for every heading this panel draws, and the reason it is a class rather than a
 * component: each machine dictates the ELEMENT its name lives on — a `<legend>` for a group, a
 * `<label>` for a single control, the slider's own label part, a plain `<span>` where a legend
 * would capture two radio groups at once. A `PreferencesHeading` component could only render one
 * of those, so what the four have in common is exactly this string and nothing else.
 *
 * Two details are load-bearing rather than taste. The size is `!` because `FieldLegend` sets its
 * own through a `data-[variant=…]:` selector, which outranks a plain class whatever the source
 * order — a non-important override there silently does nothing. And `block` is what makes `mb-2`
 * mean anything on `SliderLabel`, which is inline by default: the slider's heading sat one gap
 * tighter than the others for exactly that reason, and three headings at three spacings read as
 * three ranks once they share a grid.
 */
const PREF_HEADING = cn(
  "mb-2 block font-medium uppercase tracking-wide text-muted-foreground",
  "text-[length:var(--kanzo-font-size-small)]!",
);

/**
 * A titled GROUP of options — the container `PrefField` cannot be.
 *
 * `Field` addresses one control, and a radio group has one hidden input per item, so there is no
 * id for its label to point at; `radio-group.tsx` says exactly this, and says `FieldSet` +
 * `FieldLegend` is the answer.
 *
 * The legend really is the name, not a decoration beside one: Ark's `useRadioGroup` passes
 * `ids: { label: fieldset.ids.legend }` into the machine, and zag's root props set
 * `aria-labelledby` from it.
 */
function PrefFieldSet({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend className={PREF_HEADING}>{label}</FieldLegend>
      {children}
    </FieldSet>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────
/**
 * THEME — the panel's heading over {@link ThemePicker}, which is the one control for the theme and
 * the appearance alike. It draws nothing where the tenant offers neither.
 */
function ThemeSection({ copy }: { copy?: Partial<PreferencesCopy> }) {
  const { corePrefs } = useKanzoTheme();
  if (corePrefs.themeByAppearance?.offered === false && corePrefs.appearance?.offered === false) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className={PREF_HEADING}>{copy?.theme ?? "Theme"}</span>
      <ThemePicker copy={copy} />
    </div>
  );
}

// ── The registry: which names exist, for the type checker ────────────────────
/**
 * **Where an app says which sections it registered, once, so every name is checked.**
 *
 * TanStack Router's and Query's `Register`, spelled the same way: an empty interface the app
 * augments with the array it hands the provider —
 *
 * ```ts
 * declare module "@kanzo-tech/ui" { interface Register { sections: typeof SECTIONS } }
 * ```
 *
 * — and from then on `<Pref name>` completes, a typo fails `tsc`, and `usePref("graph.placement")`
 * answers `"force" | "map" | "clustered"`. Unaugmented, a name is any string: the registry is a
 * check an app opts into, never a step it must take before anything renders.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented by the app, which is the whole point.
export interface Register {}

type Registered = Register extends { sections: infer S extends readonly SectionShape[] } ? S[number] : never;
type SectionShape = { namespace: string; prefs?: Readonly<Record<string, unknown>> };
type NamesOf<M> = M extends { namespace: infer N extends string; prefs?: infer P }
  ? `${N}.${Extract<keyof NonNullable<P>, string>}`
  : never;
type DeclOf<N> = N extends `${infer NS}.${infer K}`
  ? NonNullable<Extract<Registered, { namespace: NS }>["prefs"]>[K & keyof NonNullable<Extract<Registered, { namespace: NS }>["prefs"]>]
  : never;

/** Every preference by its qualified name — `theme.density`, `graph.placement` — once `Register` says. */
export type PrefName = [Registered] extends [never] ? string : `${typeof CORE_NAMESPACE}.${CorePrefKey}` | NamesOf<Registered>;

/** What a preference stores: its options' values for a listed choice, a string otherwise. */
export type PrefValue<N extends string> = DeclOf<N> extends { kind: "choice"; options: readonly { value: infer V extends string }[] }
  ? V
  : string;

// ── The hook and the part ─────────────────────────────────────────────────────
/** One preference, resolved — what {@link Pref} draws and what a control of your own reads. */
export interface PrefState<V extends string = string> {
  /** The qualified name: `graph.placement`. */
  name: string;
  decl: SectionPrefDecl;
  /** What the chain answered — pinned, stored, the tenant's start or the default. */
  value: V;
  setValue: (next: V) => void;
  /** A choice's options; `null` for the other kinds, and for a source nobody beneath an owner answered. */
  options: readonly PrefOption[] | null;
  /** False where a tenant pinned or withheld it. */
  offered: boolean;
  /** Whether its `when` holds against its siblings. */
  shown: boolean;
  /** The owner's picture for each option, when it gave one. */
  specimen: PrefSpecimen | undefined;
}

/**
 * One preference, by its qualified name: the value, its setter, and whether to draw it.
 *
 * Ark's split — `useSelect` holds the state and the parts draw it — for a preference: {@link Pref}
 * is this hook drawn, and a host that wants a control of its own reads the same answer and writes
 * through the same setter, without `@kanzo-tech/ui` growing a fourth arm. `null` for a name nothing
 * declares, which is what a host that removed an optional package gets — a lost control, not a
 * thrown page.
 */
export function usePref<N extends PrefName>(name: N): PrefState<PrefValue<N>> | null {
  const theme = useKanzoTheme();
  const dot = name.indexOf(".");
  const namespace = name.slice(0, dot);
  const key = name.slice(dot + 1);
  const { sources, specimens } = useSectionContribution(namespace);
  const core = namespace === CORE_NAMESPACE;
  const section = core ? theme.corePrefs : theme.sectionPrefs[namespace];
  const pref = section?.[key];
  if (!section || !pref) return null;
  const values = Object.fromEntries(Object.entries(section).map(([k, p]) => [k, p.value]));
  return {
    name,
    decl: pref.decl,
    value: pref.value as PrefValue<N>,
    setValue: (next) => (core ? theme.set({ [key]: next }) : theme.setSectionPref(namespace, { [key]: next })),
    options: prefOptions(pref.decl, sources),
    offered: pref.offered,
    shown: prefShown(pref.decl, values),
    specimen: specimens[key],
  };
}

export interface PrefProps {
  /** The qualified name: `theme.density`, `graph.x-by`. */
  name: PrefName;
  /** The words the core's theme picker draws. A contributed section's words are its manifest's. */
  copy?: Partial<PreferencesCopy>;
}

/**
 * **One declared preference, drawn** — the part every surface composes, and the switch on `kind` in
 * one place, so no surface re-decides what a `range` looks like.
 *
 * Ark's arms, one per kind: a `choice` the author listed is a row of `RadioGroup` cards (a stepped
 * `Slider` when its options are `ordered`), a `choice` whose options a source answers is a
 * `Select` — Apple's HIG, a segmented set for a few fixed values
 * and a pop-up for a list nobody could count in advance, decided by where the options come from and
 * never by how many there are — a `toggle` is `Switch` and a `range` is `Slider`. The owner's
 * specimen is a card's content above its name, never a different control.
 *
 * It draws nothing for a preference a tenant **pinned or withheld**, one whose `when` does not hold,
 * or a sourced choice nobody answered — a control that visibly does nothing is the one thing worse
 * than no control. The core's `appearance` and `themeByAppearance` are one control, the theme
 * picker, and either name draws it.
 */
function Pref({ name, copy }: PrefProps) {
  const pref = usePref(name);
  if (!pref) return null;
  const key = name.slice(name.indexOf(".") + 1);
  if (name.startsWith(`${CORE_NAMESPACE}.`) && PICKER.has(key)) return <ThemeSection copy={copy} />;
  const { decl, value, setValue, options, specimen } = pref;
  if (!pref.offered || !pref.shown) return null;
  // The declaration's name, and the key when it has none.
  const title = decl.label ?? key;

  if (decl.kind === "toggle") {
    // `Field` and nothing else, because Ark's Switch **does** read the ambient field context — its
    // hidden input comes out carrying `aria-labelledby="field::…::label"`. That is the opposite of
    // `useSlider`, which reads none, and the difference is why a `range` needs the machine's own
    // label part and this does not.
    //
    // The control's role is `checkbox`, not `switch`: Ark renders a hidden `input type="checkbox"`
    // and does not set `role="switch"` on it. Upstream's call, adopted verbatim.
    //
    // The label sits beside the switch, as `/docs/forms/field` composes one: a name read with its
    // state, not a heading over a group — which is also what lets two toggles share a row.
    return (
      <Field orientation="horizontal">
        <FieldLabel>{title}</FieldLabel>
        <Switch checked={prefBoolean(value)} onCheckedChange={(d) => setValue(String(d.checked === true))} />
      </Field>
    );
  }

  if (decl.kind === "range") {
    // `SliderLabel` is the machine's own label part — zag points every thumb's `aria-labelledby` at
    // it — so the visible label IS the name. Named ends are the slider's own markers, Ark's
    // `Slider.Marker`, so they sit where the values are and say nothing to a screen reader twice.
    return (
      <Slider
        markerLabels={decl.ends ? [...decl.ends] : undefined}
        max={decl.max}
        min={decl.min}
        onValueChange={(d) => setValue(String(d.value[0] ?? decl.min))}
        showMarkers={decl.ends !== undefined}
        step={decl.step}
        value={[prefNumber(value, decl)]}
      >
        <SliderLabel className={PREF_HEADING}>{title}</SliderLabel>
      </Slider>
    );
  }

  if (!options) return null;
  if (!Array.isArray(decl.options)) return <PrefSelect label={title} onChange={setValue} options={options} value={value} />;
  if (decl.ordered) {
    // A scale is the range arm over the options' positions: the same Slider, its markers the
    // options' names, and the stored value the option's, never its index.
    return (
      <Slider
        markerLabels={options.map((o) => o.label)}
        max={options.length - 1}
        min={0}
        onValueChange={(d) => {
          const option = options[d.value[0] ?? 0];
          if (option) setValue(option.value);
        }}
        showMarkers
        step={1}
        value={[Math.max(0, options.findIndex((o) => o.value === value))]}
      >
        <SliderLabel className={PREF_HEADING}>{title}</SliderLabel>
      </Slider>
    );
  }
  return (
    <PrefFieldSet label={title}>
      <RadioGroup className="flex-row flex-wrap gap-2" onValueChange={(d) => d.value && setValue(d.value)} value={value}>
        {options.map((option) => (
          <RadioGroupCard
            className="min-w-0 flex-1 basis-16 flex-col items-center gap-1 px-2 py-2"
            key={option.value}
            value={option.value}
          >
            {specimen?.(option)}
            <ArkRadioGroup.ItemText className="w-full truncate text-center text-xs">{option.label}</ArkRadioGroup.ItemText>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </PrefFieldSet>
  );
}

/**
 * A choice over a list the data answers: Ark's `Select` over a `createListCollection`.
 *
 * **"None" is Ark's `deselectable` and its clear trigger**, not an option nobody declared: clearing
 * writes the empty string, which a declaration over a source takes as its default — unbound.
 */
function PrefSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (next: string) => void;
  options: readonly PrefOption[];
  value: string;
}) {
  const collection = React.useMemo(() => createListCollection({ items: [...options] }), [options]);
  return (
    <PrefField label={label}>
      <Select
        collection={collection}
        deselectable
        onValueChange={(d) => onChange(d.value[0] ?? "")}
        value={value ? [value] : []}
      >
        <SelectTrigger className="w-full" showClear>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          {collection.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PrefField>
  );
}

/**
 * Every preference a section offers, as one `<Pref>` each — the composition a settings page or a
 * panel wants when it wants all of them. **It is made of the part and is not a second way in**:
 * a page that arranges preferences its own way composes `<Pref>`s, and the conditions, the
 * tenant's policy and the owner's lists hold there exactly as they hold here.
 *
 * The core first — the theme, then density — and then whatever the packages a host installed
 * contribute, in each manifest's order. **Nothing here names a package**: the host registers
 * manifests on the provider and this draws what it is handed.
 */
export interface PreferencesSectionsProps {
  /**
   * Draw one namespace instead of all of them — `"graph"`, or `"theme"` for the core. An unknown one
   * draws nothing rather than throwing: a host that removed an optional package should lose a
   * control, not a page.
   */
  namespace?: string;
  /** The words the core's sections draw. A contributed section's words are its manifest's. */
  copy?: Partial<PreferencesCopy>;
}

/** Every word the core's sections author. The theme labels are the tenant's and are never reworded. */
export interface PreferencesCopy extends ThemePickerCopy {
  /** The heading over the theme picker. */
  theme: string;
}

/** The two declared preferences the theme picker draws as one control. */
const PICKER = new Set(["appearance", "themeByAppearance"]);

function PreferencesSections({ namespace, copy }: PreferencesSectionsProps = {}) {
  const { corePrefs, sectionPrefs } = useKanzoTheme();
  // The picker answers to two names; drawn once, at whichever the declaration lists first.
  const core = Object.keys(corePrefs).filter((key, i, keys) => !PICKER.has(key) || keys.findIndex((k) => PICKER.has(k)) === i);
  const names = [
    ...(!namespace || namespace === CORE_NAMESPACE ? core.map((key) => `${CORE_NAMESPACE}.${key}`) : []),
    ...Object.entries(sectionPrefs)
      .filter(([name]) => !namespace || name === namespace)
      .flatMap(([name, prefs]) => Object.keys(prefs).map((key) => `${name}.${key}`)),
  ];
  // Two columns, and a toggle is the one preference that takes one: a switch and its name are a
  // short row, and two of them side by side read as the pair they usually are (Vignette · Dot grid).
  // Everything else spans the row — its cards and its select want the width.
  return (
    <FieldGroup className="*:col-span-full *:has-data-[slot=switch]:col-span-1" columns={2}>
      {names.map((name) => (
        <Pref copy={copy} key={name} name={name as PrefName} />
      ))}
    </FieldGroup>
  );
}

export interface PreferencesProps extends Omit<PreferencesRootProps, "children"> {
  /** Restyle or reposition the floating trigger (it is `fixed bottom-4 end-4` by default). */
  triggerClassName?: string;
  /** The words the panel's sections draw. */
  copy?: Partial<PreferencesCopy>;
}

/**
 * All-in-one: a floating trigger + the full drawer.
 *
 * Forwards Root's props and lets the trigger be restyled or repositioned — it used to take
 * none, so a consumer could neither move the FAB nor reach the hotkey.
 *
 * There is no `Preferences.Root` / `.Panel` / `.Density` namespace. It was built with
 * `Object.assign`, and those statics do NOT survive React Server Components: once the module
 * becomes a client reference, `Preferences.Density` reads back as `undefined` and React throws
 * "Element type is invalid". It was a broken API kept beside the working one — and it was the
 * single counter-example to "no component exports dot-notation".
 */
export function Preferences({ triggerClassName, copy, ...rootProps }: PreferencesProps = {}) {
  return (
    <PreferencesRoot {...rootProps}>
      <PreferencesTrigger className={triggerClassName} />
      <PreferencesPanel copy={copy} />
    </PreferencesRoot>
  );
}

/**
 * The parts as flat named exports — the API. They cross the RSC boundary intact, tree-shake per
 * part, and match how every other compound in this library is exported (`DialogContent`, not
 * `Dialog.Content`).
 */
export {
  PreferencesRoot,
  PreferencesTrigger,
  PreferencesPanel,
  PrefField as PreferencesField,
  PrefFieldSet as PreferencesFieldSet,
  PreferencesSections,
  Pref,
};
