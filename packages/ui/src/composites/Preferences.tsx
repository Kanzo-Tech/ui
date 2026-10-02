"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import {
  CORE_PREFS,
  prefBoolean,
  prefNumber,
  prefOptions,
  themeData,
  type CorePrefKey,
  type KanzoRadius,
  type PrefOption,
  type PrefSources,
  type SectionPrefDecl,
} from "@kanzo-tech/theme";
import {
  useKanzoTheme,
  type FontOption,
  type ThemeContextValue,
} from "../theme/KanzoThemeProvider.js";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Field, FieldLabel, FieldLegend, FieldSet } from "../simples/field.js";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../simples/dialog.js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import { RadioGroup, RadioGroupCard } from "../simples/radio-group.js";
import { ThemePicker } from "./ThemePicker.js";
import { Slider, SliderLabel } from "../simples/slider.js";
import { Switch } from "../simples/switch.js";

/**
 * Preferences — a live theming selector (composite) for PRODUCT settings. A non-modal drawer
 * (metadata-form's UX) that drives {@link useKanzoTheme}, which writes `data-*` attributes to
 * `<html>` and toggles `.dark`, so every component re-skins with no changes. The default panel is
 * the canonical product set:
 *
 *   <PreferencesRoot>
 *     <PreferencesTrigger />
 *     <PreferencesPanel>
 *       <ThemePicker /> <PreferencesDensity /> <PreferencesRadius />
 *       <PreferencesFont /> <PreferencesMonoFont />
 *     </PreferencesPanel>
 *   </PreferencesRoot>
 *
 * or the all-in-one <Preferences />. Those five sections ARE the default panel body, plus a footer
 * of Reset · Done. Open with `t`, close with Escape.
 *
 * **No colour is AUTHORED here.** A tenant's identity is a palette DOCUMENT — derived and measured
 * once at onboarding, compiled to one stylesheet the server inlines — not something a user picks a
 * hue at a time. Palette, accent, base, chart scheme and the "Copy CSS" export all left with it;
 * what the export did belongs on the onboarding surface, which has a document to emit.
 *
 * The theme is not that coming back. {@link ThemePicker} chooses among the themes the TENANT
 * published — a light theme and a dark theme, GitHub's model — and it is also the one appearance
 * control: its *Light · Dark* segment picks the side. There is no toggle in the header and no
 * second control for either.
 *
 * **What a tenant pinned or withheld is not drawn at all.** Every section asks `corePrefs[key]`
 * whether its axis is still offered, because a control the chain will ignore is a control that
 * visibly does nothing.
 *
 * **One renderer draws every preference**, the core's axes and a contributed section's alike:
 * `PrefControl` switches on `kind` and nothing else. Two sections are left, each because its
 * CONTROL differs rather than its data — `RadiusSection` is a slider over an ordered scale, and
 * the theme is {@link ThemePicker}, which draws each theme as a live miniature. The three specimens a
 * generic control cannot draw are a lookup keyed by axis, not three components.
 */

// Off the declaration, which is generated from the same table `themes.css` is emitted from. This
// was typed here — beside a `themeData` import that already carried it — and a hand-copy disagrees
// with the CSS the moment the generator changes. `?? []` is unreachable for a core axis (its
// options are a literal list, never a source), and is how `prefOptions` says so in the type.
//
// It survives the collapse into one renderer because the radius control is a SLIDER and needs the
// steps in order, as an array it can index. Every other axis reads its options off the declaration
// at the point of drawing.
const RADII = (prefOptions(CORE_PREFS.radius) ?? []).map((o) => o.value as KanzoRadius);
// ── Root: Ark Dialog (non-modal, live-preview) + hotkey ──────────────────────
export interface PreferencesRootProps {
  children: React.ReactNode;
  /**
   * Key that toggles the panel, e.g. `"t"`. **Opt-in — there is no default.**
   *
   * When set, this registers a `window` keydown listener that fires on the bare key (typing in
   * an input, textarea or contenteditable is ignored). A design system must not claim a
   * single, unmodified key in its host's global keymap without being asked, so omit this
   * unless the host has decided that key is free.
   */
  hotkey?: string;
  defaultOpen?: boolean;
}

function PreferencesRoot({ children, hotkey, defaultOpen = false }: PreferencesRootProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== hotkey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

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
function PreferencesPanel({
  children,
  title = "Preferences",
  hint = "Applied live · saved to this browser.",
}: {
  children?: React.ReactNode;
  title?: string;
  hint?: string;
}) {
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
            {children ?? (
              <>
                <ThemeSection />
                <DensitySection />
                <RadiusSection />
                <FontSection />
                <MonoFontSection />
                {/* Last, and in the same visual language as the five above. A package that owns a
                    user-facing choice contributes it here rather than building a settings surface
                    of its own beside this one — which is the whole difference between one product
                    and several sharing a window. */}
                <ContributedSections />
              </>
            )}
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
function ThemeSection() {
  const { corePrefs } = useKanzoTheme();
  if (corePrefs.themeByAppearance?.offered === false && corePrefs.appearance?.offered === false) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className={PREF_HEADING}>Theme</span>
      <ThemePicker />
    </div>
  );
}

/**
 * One declared preference, drawn — the switch on `kind`, in one place.
 *
 * **It draws the core's axes and a contributed section's alike**, which is the point: `Font`,
 * `Mono font` and `Density` were three components that differed only in which specimen they put on
 * a card, and a fourth surface rendering a contributed group had to re-decide what a `range` looks
 * like. The three arms are the primitives the panel already used: `choice` is a radio list,
 * `toggle` is `Switch`, `range` is `Slider`.
 *
 * A value is a string in storage for all three — see `SectionPrefDecl` — so each arm parses on the
 * way in with the section mechanism's own readers rather than a local `Number()` that would differ
 * from what the resolver validated against.
 *
 * `specimen` is the escape hatch, and it is the only one: a generic control cannot draw a typeface
 * in its own face or a size at its real size. What it may not do is change the CONTROL — a
 * declaration that needs a different one is a section of its own, and there are two of those left
 * ({@link RadiusSection}, {@link ThemeSection}), each saying why in its own comment.
 */
function PrefControl({
  name,
  onChange,
  pref,
  sources,
  specimen,
}: {
  name: string;
  onChange: (next: string) => void;
  pref: { value: string; decl: SectionPrefDecl };
  /** What the tenant published, for a choice whose options name a source. */
  sources?: PrefSources;
  /** Drawn above each option's name. Its presence is also what lays the cards out in a row. */
  specimen?: (option: PrefOption) => React.ReactNode;
}) {
  const { decl, value } = pref;
  // The declaration's name, and the key when it has none — which is what every surface drew before
  // a preference could carry one, and is still what an older manifest gets.
  const title = decl.label ?? name;

  if (decl.kind === "toggle") {
    // `Field` and nothing else, because Ark's Switch **does** read the ambient field context — its
    // hidden input comes out carrying `aria-labelledby="field::…::label"`. That is the opposite of
    // `useSlider`, which reads none, and the difference is why `RadiusSection` needs the machine's
    // own label part and this does not. An `aria-label` here was tried and is exactly the
    // duplication this panel keeps removing: it lands on the `<label>` root, which has no role, so
    // it names nothing and hides that the wiring was already correct.
    //
    // The control's role is `checkbox`, not `switch`: Ark renders a hidden `input type="checkbox"`
    // and does not set `role="switch"` on it. Upstream's call, adopted verbatim.
    return (
      <PrefField label={title}>
        <Switch
          checked={prefBoolean(value)}
          onCheckedChange={(d) => onChange(String(d.checked === true))}
        />
      </PrefField>
    );
  }

  if (decl.kind === "range") {
    // `SliderLabel` is the machine's own label part — zag points every thumb's `aria-labelledby` at
    // it — so the visible label IS the name, the way `RadiusSection` does it.
    return (
      <Slider
        max={decl.max}
        min={decl.min}
        onValueChange={(d) => onChange(String(d.value[0] ?? decl.min))}
        step={decl.step}
        value={[prefNumber(value, decl)]}
      >
        <SliderLabel className={PREF_HEADING}>{title}</SliderLabel>
      </Slider>
    );
  }

  // `?? []` and not a throw: a choice whose source the host has not answered yet has nothing to
  // offer *this render*, and the value it resolved to is still applied.
  const options = prefOptions(decl, sources) ?? [];
  // A specimen is wide and wants its name under it; a bare name is a row in a list. One rule, read
  // off the data, rather than a layout prop each call site has to remember to pass.
  return (
    <PrefFieldSet label={title}>
      <RadioGroup
        className={specimen ? "flex-row flex-wrap gap-2" : "gap-2"}
        onValueChange={(d) => d.value && onChange(d.value)}
        value={value}
      >
        {options.map((option) => (
          <RadioGroupCard
            className={
              specimen
                ? "min-w-0 flex-1 basis-20 flex-col items-center gap-1 px-2 py-2"
                : "items-center px-2.5 py-2"
            }
            key={option.value}
            value={option.value}
          >
            {specimen?.(option)}
            <ArkRadioGroup.ItemText
              className={
                specimen
                  ? "w-full truncate text-center text-muted-foreground text-xs"
                  : "text-xs"
              }
            >
              {option.label}
            </ArkRadioGroup.ItemText>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </PrefFieldSet>
  );
}

/**
 * Whatever the packages this host installed contribute — one group per declared preference.
 *
 * **Nothing here names a package.** The host registers manifests on the provider, the provider
 * resolves them, and this renders what it is handed; `@kanzo-tech/ui` gains no reference to
 * `@kanzo-tech/graph` and a host that never installed it passes nothing and draws nothing.
 *
 * Three things it declines to draw, each for a reason that belongs to the section rather than to the
 * panel: a preference a tenant **pinned** or **withheld** (`offered` is false, and the two are the
 * same instruction here for different reasons upstream), and a namespace whose manifest declares
 * only tokens. That last one is filtered in the provider, so an empty legend cannot reach the DOM.
 *
 * A contributed preference gets `RadioGroupCard` and not something new, because the choice it
 * expresses is the one `Theme` and `Density` already express — pick one of these, they have names.
 */
export interface PreferencesSectionsProps {
  /**
   * Draw one namespace instead of all of them.
   *
   * **This is what makes a preference one thing with several surfaces.** A panel wants every
   * contributed section; a dock inside a canvas wants the graph's and nothing else; a settings page
   * may want them under its own headings. Without it a surface that is not the panel has to
   * hand-roll the controls — which is how the workspace's dock came to hold its own copy of the
   * graph's appearance in React state, a second store for a preference the provider was already
   * resolving.
   *
   * The namespace is the section's own — `"graph"` — and an unknown one draws nothing rather than
   * throwing: a host that removed an optional package should lose a control, not a page.
   */
  namespace?: string;
  /**
   * Draw only these preferences, by name, in this order.
   *
   * The third selection, and the one a **dock** needs: a canvas has a panel for the forces and a
   * panel for the picture, and both are the same section. Without it the surface either draws the
   * whole section in one place or goes back to hand-rolling — which is the state this mechanism was
   * built to end, so a selection that stops at the namespace stops one step short.
   *
   * Order is the caller's here, where a section's own order is the manifest's. That is the same
   * split `ThemePicker` already makes: what to offer belongs to whoever declared it, how to
   * arrange a page belongs to the page. A name nothing declares draws nothing.
   */
  only?: readonly string[];
}

function ContributedSections({ namespace, only }: PreferencesSectionsProps = {}) {
  const { sectionPrefs, setSectionPref, themes } = useKanzoTheme();

  // The one list only a tenant can write, in the shape a declaration names it by. Built here and
  // handed down rather than read inside the control, so the same control renders under a test that
  // has no provider.
  const sources: PrefSources = React.useMemo(
    () => ({ themes: themes.map(({ label, value }) => ({ label, value })) }),
    [themes],
  );

  const drawn = namespace
    ? Object.entries(sectionPrefs).filter(([name]) => name === namespace)
    : Object.entries(sectionPrefs);

  // The caller's order when it named the set, the manifest's when it did not. The entry type is
  // read off the context rather than re-declared: it is `ResolvedPref & { decl }`, and a second
  // spelling of it here would be one more thing to keep in step.
  type Entry = ThemeContextValue["sectionPrefs"][string][string];
  const chosen = (prefs: Record<string, Entry>): [string, Entry][] =>
    only
      ? only.flatMap((key) => {
          const pref = prefs[key];
          return pref ? [[key, pref] as [string, Entry]] : [];
        })
      : Object.entries(prefs);

  return (
    <>
      {drawn.map(([name, prefs]) =>
        chosen(prefs).map(([key, pref]) =>
          pref.offered ? (
            <PrefControl
              key={`${name}.${key}`}
              name={key}
              onChange={(next) => setSectionPref(name, { [key]: next })}
              pref={pref}
              sources={sources}
            />
          ) : null,
        ),
      )}
    </>
  );
}

// The one section where neither container above applies. A slider is a single control, so it is not
// a `FieldSet`; and Ark's `useSlider` reads no ambient context at all — not Field, not Fieldset — so
// a `FieldLabel` could not reach it either, which is why "Radius" was written twice. `SliderLabel`
// is the machine's own label part: zag points every thumb's `aria-labelledby` at it by default, so
// the visible label IS the name and there is nothing to repeat.
/**
 * Whether to draw a control for a core axis at all.
 *
 * A tenant may PIN one — their product is square, and nobody chooses otherwise — or WITHHOLD it,
 * and both mean the same thing to a surface. The resolution already ignores a stored value in
 * either case, so a control drawn here would be one that visibly does nothing.
 */
const useOffered = (key: string) => useKanzoTheme().corePrefs[key]?.offered !== false;

function RadiusSection() {
  const { radius, set } = useKanzoTheme();
  const offered = useOffered("radius");
  const index = Math.max(0, RADII.indexOf(radius));
  if (!offered) return null;
  return (
    <Slider
      min={0}
      max={RADII.length - 1}
      step={1}
      value={[index]}
      onValueChange={(d) => set({ radius: RADII[d.value[0] ?? 3] ?? "md" })}
      showMarkers
      markerLabels={[...RADII]}
    >
      <SliderLabel className={PREF_HEADING}>Radius</SliderLabel>
    </Slider>
  );
}

/**
 * The specimens a generic control cannot draw, keyed by axis — the escape hatch, in one place.
 *
 * Three, and they replaced three components that differed in nothing else: `FontSection`,
 * `MonoFontSection` and `DensitySection` each wrapped the same radio list around the same card
 * around a different `<span>`. What is left is the span.
 *
 * They take the theme because two of them do: a host may replace `fonts` with its own stacks, and a
 * specimen showing a face the page does not use is worse than no specimen.
 */
type Specimen = (option: PrefOption, theme: ThemeContextValue) => React.ReactNode;

const face = (options: FontOption[], value: string) =>
  options.find((option) => option.value === value)?.preview;

const SPECIMENS: Record<string, Specimen> = {
  font: (option, { fonts }) => (
    <span className="text-xl leading-none text-foreground" style={{ fontFamily: face(fonts, option.value) }}>
      Ag
    </span>
  ),
  monoFont: (option, { monoFonts }) => (
    <span
      className="text-xl leading-none text-foreground"
      style={{ fontFamily: face(monoFonts, option.value) }}
    >
      Ag
    </span>
  ),
  // The root font-size everything scales from, drawn at its real size — `em` inside a card whose
  // own `font-size` is set is a true preview rather than a description of one. The pixel values are
  // the generated ones: a hand-copy here would disagree with the CSS the moment the generator moves.
  density: (option) => (
    <span
      className="flex items-center gap-1 leading-none text-foreground"
      style={{ fontSize: themeData.densities[option.value as keyof typeof themeData.densities] }}
    >
      <span className="rounded-[0.25em] bg-primary px-[0.4em] py-[0.15em] text-[0.7em] font-medium text-primary-foreground">
        Aa
      </span>
      <span className="text-[0.8em]">abc</span>
    </span>
  ),
};

/**
 * One core axis, drawn by the one renderer.
 *
 * Everything that used to differ between the four is data now: the name, the options and the kind
 * are the declaration's, the specimen is a lookup, and whether to draw at all is the chain's
 * answer. What a host sees is unchanged — this is the same markup those components
 * emitted, which `Preferences.test.tsx` checks by rendering rather than by reading the source.
 */
function CoreSection({ axis }: { axis: CorePrefKey }) {
  const theme = useKanzoTheme();
  const pref = theme.corePrefs[axis];
  if (!pref?.offered) return null;
  const specimen = SPECIMENS[axis];
  return (
    <PrefControl
      name={axis}
      onChange={(next) => theme.set({ [axis]: next })}
      pref={pref}
      sources={theme.sources}
      {...(specimen ? { specimen: (option: PrefOption) => specimen(option, theme) } : {})}
    />
  );
}

const FontSection = () => <CoreSection axis="font" />;
const MonoFontSection = () => <CoreSection axis="monoFont" />;
const DensitySection = () => <CoreSection axis="density" />;

export interface PreferencesProps extends Omit<PreferencesRootProps, "children"> {
  /** Restyle or reposition the floating trigger (it is `fixed bottom-4 end-4` by default). */
  triggerClassName?: string;
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
export function Preferences({ triggerClassName, ...rootProps }: PreferencesProps = {}) {
  return (
    <PreferencesRoot {...rootProps}>
      <PreferencesTrigger className={triggerClassName} />
      <PreferencesPanel />
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
  // Flat like every other section, and for the reason the others are: a host composing its own
  // panel with `children` replaces the canonical set, and without this it would silently drop every
  // choice its installed packages contribute — which is the several-products-in-one-window failure
  // the mechanism exists to remove, reintroduced by the escape hatch.
  ContributedSections as PreferencesSections,
  RadiusSection as PreferencesRadius,
  FontSection as PreferencesFont,
  MonoFontSection as PreferencesMonoFont,
  DensitySection as PreferencesDensity,
};
