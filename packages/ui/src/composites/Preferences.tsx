"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import { DEFAULT_PREFS, themeData, type KanzoRadius } from "@kanzo-tech/theme";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";
import { cn } from "../lib/cn.js";
import { AppearanceToggle } from "./AppearanceToggle.js";
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
import { Slider, SliderLabel } from "../simples/slider.js";

/**
 * Preferences — a live theming selector (composite) for PRODUCT settings. A non-modal drawer
 * (metadata-form's UX) that drives {@link useKanzoTheme}, which writes `data-*` attributes to
 * `<html>` and toggles `.dark`, so every component re-skins with no changes. The default panel is
 * the canonical product set:
 *
 *   <Preferences.Root>
 *     <Preferences.Trigger />
 *     <Preferences.Panel>
 *       <Preferences.Density /> <Preferences.Radius />
 *       <Preferences.Font /> <Preferences.MonoFont />
 *     </Preferences.Panel>
 *   </Preferences.Root>
 *
 * or the all-in-one <Preferences />. Those four sections ARE the default panel body, plus a footer
 * of Reset · Done. Open with `t`, close with Escape.
 *
 * **Colour is not here.** A tenant's identity is a palette DOCUMENT — derived and measured once at
 * onboarding, compiled to one stylesheet the server inlines — not something a user picks a hue at a
 * time. Palette, accent, base, chart scheme and the "Copy CSS" export all left with it; what the
 * export did belongs on the onboarding surface, which has a document to emit.
 *
 * **Appearance is not here either**, and that is a different argument: it is still a preference,
 * but it already has a control. `AppearanceToggle` cycles all three states in one click, in the
 * chrome, where a one-click preference belongs. A section here would be the same preference
 * wearing a second control — the duplication this panel keeps removing everywhere else.
 */

const RADII: KanzoRadius[] = ["none", "xs", "sm", "md", "lg"];
const DENSITIES = [
  { value: "default", label: "Default" },
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Cozy" },
] as const;
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
            "pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-80 flex-col overflow-hidden",
            "rounded-lg border border-border bg-popover text-popover-foreground shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-4",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-4",
            "motion-reduce:animate-none!",
          )}
        >
          {/* Header. Appearance sits here, beside the close X, and not as a body section: it is
              one control, and a section of three cards was a second one for the same preference.
              In the header it stays a one-click cycle and costs the body nothing. */}
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="font-heading text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-[length:var(--kanzo-font-size-small)] text-muted-foreground">
              {hint}
            </DialogDescription>
          </div>
          <div className="absolute inset-e-3.5 top-3.5 flex items-center gap-0.5">
            <AppearanceToggle size="icon-sm" className="opacity-64 hover:opacity-100" />
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
                <DensitySection />
                <RadiusSection />
                <FontSection />
                <MonoFontSection />
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
  const { set } = useKanzoTheme();
  // The defaults, spread — not a hand-copy of them. The hand-copy this replaced listed axes by
  // name and had silently stopped covering the panel more than once.
  const reset = () => set({ ...DEFAULT_PREFS });
  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/48 px-4 py-3">
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
      <FieldLabel className={cn(PREF_LABEL_SIZE, PREF_LABEL)}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

// One label look for both containers below, so a `Field`-labelled section and a `FieldSet`-labelled
// one are indistinguishable. The size is `!` on the legend because `FieldLegend` sets its own
// through a `data-[variant=…]:` variant — an attribute-qualified selector that outranks a plain
// class whatever the source order, so a non-important override there silently does nothing.
const PREF_LABEL = "font-medium uppercase tracking-wide text-muted-foreground";
const PREF_LABEL_SIZE = "text-[length:var(--kanzo-font-size-small)]";

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
      <FieldLegend className={cn(`${PREF_LABEL_SIZE}!`, PREF_LABEL, "mb-2")}>{label}</FieldLegend>
      {children}
    </FieldSet>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────
// The one section where neither container above applies. A slider is a single control, so it is not
// a `FieldSet`; and Ark's `useSlider` reads no ambient context at all — not Field, not Fieldset — so
// a `FieldLabel` could not reach it either, which is why "Radius" was written twice. `SliderLabel`
// is the machine's own label part: zag points every thumb's `aria-labelledby` at it by default, so
// the visible label IS the name and there is nothing to repeat.
function RadiusSection() {
  const { radius, set } = useKanzoTheme();
  const index = Math.max(0, RADII.indexOf(radius));
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
      <SliderLabel className={cn(PREF_LABEL_SIZE, PREF_LABEL)}>Radius</SliderLabel>
    </Slider>
  );
}

/** Font cards laid out horizontally: a large specimen in the typeface on top, name below. */
function FontPicker({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: { value: string; label: string; preview?: string }[];
  onSelect: (v: string) => void;
}) {
  return (
    // No `aria-label`: the section's `FieldLegend` is the group's name, and the copy that lived here
    // was hard-coded "Font" — so the mono-font group announced itself as "Font" too.
    <RadioGroup
      className="flex-row flex-wrap gap-2"
      onValueChange={(d) => d.value && onSelect(d.value)}
      value={value}
    >
      {options.map((o) => (
        <RadioGroupCard
          className="min-w-0 flex-1 basis-20 flex-col items-center gap-1 px-2 py-2"
          key={o.value}
          value={o.value}
        >
          <span className="text-xl leading-none text-foreground" style={{ fontFamily: o.preview }}>
            Ag
          </span>
          <ArkRadioGroup.ItemText className="w-full truncate text-center text-muted-foreground text-xs">
            {o.label}
          </ArkRadioGroup.ItemText>
        </RadioGroupCard>
      ))}
    </RadioGroup>
  );
}

function FontSection() {
  const { font, fonts, set } = useKanzoTheme();
  return (
    <PrefFieldSet label="Font">
      <FontPicker value={font} options={fonts} onSelect={(v) => set({ font: v })} />
    </PrefFieldSet>
  );
}

function MonoFontSection() {
  const { monoFont, monoFonts, set } = useKanzoTheme();
  return (
    <PrefFieldSet label="Mono font">
      <FontPicker value={monoFont} options={monoFonts} onSelect={(v) => set({ monoFont: v })} />
    </PrefFieldSet>
  );
}

// Density = the root font-size everything scales from. Each card previews at its real size so
// the difference is visible (mirrors the Font/MonoFont specimen cards).
// Derived, not re-typed: these are generated into theme-data.json by gen-theme.mjs, and a
// hand-copy here would silently disagree with the CSS the moment the generator changes.
const DENSITY_PX: Record<string, string> = themeData.densities;
function DensitySection() {
  const { density, set } = useKanzoTheme();
  return (
    <PrefFieldSet label="Density">
      <RadioGroup
        className="flex-row flex-wrap gap-2"
        onValueChange={(d) => d.value && set({ density: d.value as (typeof DENSITIES)[number]["value"] })}
        value={density}
      >
        {DENSITIES.map((o) => (
          <RadioGroupCard
            className="min-w-0 flex-1 basis-20 flex-col items-center gap-1.5 px-2 py-2"
            key={o.value}
            value={o.value}
          >
            {/* `em` scales relative to this card's fixed font-size → a true preview. */}
            <span
              className="flex items-center gap-1 leading-none text-foreground"
              style={{ fontSize: DENSITY_PX[o.value] }}
            >
              <span className="rounded-[0.25em] bg-primary px-[0.4em] py-[0.15em] text-[0.7em] font-medium text-primary-foreground">
                Aa
              </span>
              <span className="text-[0.8em]">abc</span>
            </span>
            <ArkRadioGroup.ItemText className="w-full truncate text-center text-muted-foreground text-xs">
              {o.label}
            </ArkRadioGroup.ItemText>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </PrefFieldSet>
  );
}

export interface PreferencesProps extends Omit<PreferencesRootProps, "children"> {
  /** Restyle or reposition the floating trigger (it is `fixed bottom-4 end-4` by default). */
  triggerClassName?: string;
}

/** Compound: Root provider + Trigger + Panel + standalone sections. */
export const Preferences = Object.assign(
  /**
   * All-in-one: a floating trigger + the full drawer.
   *
   * Forwards Root's props and lets the trigger be restyled or repositioned — it used to take
   * none, so a consumer could neither move the FAB nor reach the hotkey.
   */
  function Preferences({ triggerClassName, ...rootProps }: PreferencesProps = {}) {
    return (
      <PreferencesRoot {...rootProps}>
        <PreferencesTrigger className={triggerClassName} />
        <PreferencesPanel />
      </PreferencesRoot>
    );
  },
  {
    Root: PreferencesRoot,
    Trigger: PreferencesTrigger,
    Panel: PreferencesPanel,
    Radius: RadiusSection,
    Font: FontSection,
    MonoFont: MonoFontSection,
    Density: DensitySection,
  },
);

/**
 * The same parts as flat named exports.
 *
 * Prefer these. The `Preferences.X` namespace above is built with `Object.assign`, and those
 * statics do NOT survive React Server Components: once the module becomes a client reference,
 * `Preferences.Density` reads back as `undefined` and React throws "Element type is invalid".
 * Flat exports cross the boundary intact, tree-shake per part, and match how every other
 * compound component in this library is exported (`DialogContent`, not `Dialog.Content`).
 */
export {
  PreferencesRoot,
  PreferencesTrigger,
  PreferencesPanel,
  PrefField as PreferencesField,
  PrefFieldSet as PreferencesFieldSet,
  RadiusSection as PreferencesRadius,
  FontSection as PreferencesFont,
  MonoFontSection as PreferencesMonoFont,
  DensitySection as PreferencesDensity,
};
