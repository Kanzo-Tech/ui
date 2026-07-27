"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { MonitorIcon, PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import {
  DEFAULT_PREFS,
  PALETTES,
  SCHEMES,
  resolvePalette,
  themeData,
  type KanzoAccent,
  type KanzoBase,
  type KanzoRadius,
  type PaletteSlot,
} from "@kanzo-tech/theme";
import { useKanzoTheme, type ThemePrefs } from "../theme/KanzoThemeProvider.js";
import { cn } from "../lib/cn.js";
import { customBaseVars, readableForeground } from "../lib/color.js";
import { Button } from "../simples/button.js";
import { Field, FieldLabel, FieldLegend, FieldSet } from "../simples/field.js";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../simples/dialog.js";
import { AppearanceToggle } from "./AppearanceToggle.js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import { RadioGroup, RadioGroupCard } from "../simples/radio-group.js";
import { Slider, SliderLabel } from "../simples/slider.js";
import { SwatchGroup } from "../simples/swatch.js";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSwatch,
  ColorPickerSwatchGroup,
  ColorPickerSwatchIndicator,
  ColorPickerSwatchPreview,
  ColorPickerSwatchTrigger,
  ColorPickerTrigger,
  ColorPickerValue,
} from "../simples/color-picker.js";

/**
 * Preferences — a live theming selector (composite) for PRODUCT settings. A non-modal drawer
 * (metadata-form's UX) that drives {@link useKanzoTheme}, which writes `data-*` attributes to
 * `<html>` so every component re-skins with no changes. Dark is delegated (next-themes or the
 * provider's fallback). The default panel is the canonical product set:
 *
 *   <Preferences.Root>
 *     <Preferences.Trigger />
 *     <Preferences.Panel>
 *       <Preferences.Palette /> <Preferences.Accent /> <Preferences.Base />
 *       <Preferences.Scheme /> <Preferences.Radius /> <Preferences.Font />
 *       <Preferences.MonoFont /> <Preferences.Density />
 *     </Preferences.Panel>
 *   </Preferences.Root>
 *
 * or the all-in-one <Preferences />. Those eight sections ARE the default panel body (appearance is
 * the header toggle beside the close), plus a
 * footer of Reset · Copy CSS · Done. (This comment used to claim `Base` was opt-in and omitted
 * by default; the panel has rendered it for some time — the code is the authority.) Open with
 * `t`, close with Escape.
 */

const RADII: KanzoRadius[] = ["none", "xs", "sm", "md", "lg"];
/**
 * base16's eight accent slots — the part of a palette that reads as its identity at a glance.
 *
 * `base00`–`base07` are the neutral ramp, which every palette spends on surfaces and ink, so a
 * sixteen-swatch strip in a 320px panel would be half greys. Order is base16's, not sorted: see
 * `SwatchGroup.colors`.
 */
const PALETTE_ACCENT_SLOTS: PaletteSlot[] = [
  "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F",
];
// The swatch a named axis value shows, and the way back from a picked colour to that name.
//
// Generated, not written here. The hand-written tables these replace had drifted to Tailwind **v3**
// while the theme resolves v4 — the panel offered `#2563eb` for "blue" and selecting it produced a
// different blue in every token. Every curated accent was wrong, and four of the base scales.
const ACCENT_SWATCHES = themeData.accentSwatches as Record<KanzoAccent, string>;
const BASE_SWATCHES = themeData.baseSwatches as Record<KanzoBase, string>;
const byHex = <T extends string>(table: Record<T, string>): Record<string, T> =>
  Object.fromEntries(Object.entries(table).map(([name, hex]) => [(hex as string).toLowerCase(), name])) as Record<string, T>;
const BASE_HEX_TO_NAME = byHex(BASE_SWATCHES);
const ACCENT_HEX_TO_NAME = byHex(ACCENT_SWATCHES);
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
          {/* Header — the close X uses the canonical absolute placement (as dialog/popover). */}
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="font-heading text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-[length:var(--kanzo-font-size-small)] text-muted-foreground">
              {hint}
            </DialogDescription>
          </div>
          {/* Header controls, top-end: the appearance toggle is one compact icon — it lives here
              beside the close rather than taking a full body row of its own. */}
          <div className="absolute inset-e-3.5 top-3.5 flex items-center gap-0.5">
            <AppearanceToggle
              size="icon-sm"
              variant="ghost"
              className="opacity-64 hover:opacity-100"
            />
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
              does not show all its fields" bug: the panel was never scrolling at all.
              Pinning the items at their natural height is what makes `overflow-y-auto` real. */}
          <form
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 [&>*]:shrink-0"
            onSubmit={(e) => e.preventDefault()}
          >
            {children ?? (
              <>
                {/* First: the palette is the colour identity, and everything below it is either a
                    narrower choice (accent, base) or a different axis entirely. */}
                <PaletteSection />
                <AccentSection />
                <BaseSection />
                <SchemeSection />
                <RadiusSection />
                <FontSection />
                <MonoFontSection />
                <DensitySection />
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

/** Actions bar pinned to the bottom of the panel (Reset · Copy CSS · Done). */
function PreferencesFooter() {
  const { set } = useKanzoTheme();
  // The defaults, spread — not a hand-copy of them. The hand-copy listed seven axes and had
  // silently stopped covering the panel: `scheme`, `schemeColors`, `baseTint`, and then
  // `palette`/`appearance`, so Reset left a Dracula panel on Dracula. The three overrides are
  // absent from `DEFAULT_PREFS` (their default is "not set"), so they have to be cleared by name —
  // spreading alone would leave a custom primary or a registered scheme in place.
  //
  // `appearance` comes from the same spread, which also matters: `set` pins the side whenever a
  // patch carries `palette` without one, and passing both is how you say "back to following the OS".
  const reset = () =>
    set({ ...DEFAULT_PREFS, primary: undefined, baseTint: undefined, schemeColors: undefined });
  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/48 px-4 py-3">
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        Reset
      </Button>
      <CopyTheme className="ms-auto w-auto" />
      <DialogClose asChild>
        <Button type="button" size="sm">
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
 * `FieldLegend` is the answer. Five sections had written their name twice in the meantime — once
 * visibly through `PrefField`, once as an `aria-label` — which is the defect `PrefField`'s own doc
 * comment claims to have ended. One of the two copies had already drifted: `MonoFont` announced
 * itself as "Font".
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
/** A curated option: the hex the swatch paints, and the NAME the reader is choosing. */
interface ColorPreset {
  value: string;
  label: string;
}

const presetsOf = (table: Record<string, string>): ColorPreset[] =>
  Object.entries(table).map(([name, value]) => ({
    value,
    label: name.charAt(0).toUpperCase() + name.slice(1),
  }));

/**
 * The shared colour-picker control (Shark's, controlled) used by BOTH accent and base: the curated
 * presets inline, a trigger showing the current colour, and a popover with area/hue/hex behind it.
 *
 * The presets used to live INSIDE the popover, which made these two the only sections of seven that
 * hid their options behind a click — the panel read as having three swatch idioms rather than one.
 * They are legal out here: `ColorPickerSwatchGroup` and `ColorPickerSwatchTrigger` each merge one
 * call to `useColorPickerContext()`, which `ColorPicker` (the Root) provides; neither touches the
 * content's presence machinery, and Content is `lazyMount`/`unmountOnExit`, so anything left inside
 * it does not exist while the popover is shut. The popover keeps what actually needs it — the
 * custom colour.
 *
 * `size-6` + `gap-1.5`, measured rather than guessed: the panel is `w-80` less `px-5`, so 280px,
 * and the widest set is the nine base scales at 9×24 + 8×6 = 264. Ark's own `size-8`/`gap-2` needs
 * 352 and wraps to a ragged second row.
 *
 * Both accessible names are ours. Ark's swatch group is `role="group"` with no name at all, and
 * every trigger is labelled `select #155dfc as the color` — the wrong sentence when the reader is
 * choosing "Blue". A caller-supplied prop wins: both parts end in
 * `mergeProps(machineProps, callerProps)`, and zag's `mergeProps` takes the later value for
 * anything that is not a handler, a class or a style.
 */
function ColorField({
  value,
  onValueChange,
  presets,
  presetsLabel,
}: {
  value: string;
  onValueChange: (hex: string) => void;
  presets: ColorPreset[];
  /** Names the preset row — `role="group"` with no name is an unlabelled group. */
  presetsLabel: string;
}) {
  return (
    // Hex, not `valueAsString`. Ark serialises to `rgba(21, 93, 252, 1)`, and both callers look the
    // result up in a hex→name table to decide whether a pick is a *named* axis value or a custom
    // colour. With an `rgba(…)` string that lookup can never hit, so every pick — including the
    // curated presets — fell through to the custom branch. `Base` carried a comment promising the
    // opposite behaviour for as long as the picker has existed.
    <ColorPicker
      value={value}
      onValueChange={(e) => onValueChange(e.value.toString("hex"))}
      className="w-full flex-col gap-2"
    >
      <ColorPickerSwatchGroup aria-label={presetsLabel} className="gap-1.5">
        {presets.map((p) => (
          <ColorPickerSwatchTrigger aria-label={p.label} className="size-6" key={p.value} value={p.value}>
            <ColorPickerSwatch value={p.value}>
              <ColorPickerSwatchIndicator />
            </ColorPickerSwatch>
          </ColorPickerSwatchTrigger>
        ))}
      </ColorPickerSwatchGroup>
      <ColorPickerControl className="w-full">
        <ColorPickerTrigger className="flex w-full items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/32">
          <ColorPickerSwatchPreview className="size-5 rounded-full border border-black/10" />
          <ColorPickerValue className="text-muted-foreground" />
        </ColorPickerTrigger>
      </ColorPickerControl>
      <ColorPickerContent className="w-64">
        <ColorPickerArea className="h-32">
          <ColorPickerAreaThumb />
        </ColorPickerArea>
        <ColorPickerSlider channel="hue" />
        <ColorPickerInput />
      </ColorPickerContent>
    </ColorPicker>
  );
}

/**
 * Accent = a real colour picker: curated swatches + custom area/hex.
 *
 * Picking a curated swatch selects the **named** accent, the way `Base` already did. It used to
 * write a custom `primary` for every pick, including the presets — so `data-accent` was generated,
 * documented and tested, and unreachable from the only panel that offers accents. A custom colour
 * still becomes a `primary` override; that is what the override is for.
 */
function AccentSection() {
  const { accent, primary, set } = useKanzoTheme();
  return (
    <PrefField label="Accent">
      <ColorField
        // `accent` is typed open (any hue in the full generated set), while the swatches only cover
        // the curated six — so an accent set outside the panel falls back rather than showing blank.
        value={primary ?? ACCENT_SWATCHES[accent] ?? (ACCENT_SWATCHES.neutral as string)}
        onValueChange={(hex) => {
          const named = ACCENT_HEX_TO_NAME[hex.toLowerCase()];
          if (named) set({ accent: named, primary: undefined });
          else set({ primary: hex });
        }}
        presets={presetsOf(ACCENT_SWATCHES)}
        presetsLabel="Accent presets"
      />
    </PrefField>
  );
}

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

/**
 * Scheme = the categorical colours, the axis `base` and `accent` never covered.
 *
 * A named list rather than a colour picker, and that is the reference's answer, not a shortcut:
 * a categorical palette is a *set* whose safety comes from fixed hue anchors in a derived order,
 * so picking one hue and rotating from it collapses under colour-blindness simulation. Plot names
 * its schemes for the same reason. The escape hatch is the `schemeColors` pref — Vega's
 * `vega.scheme(name, colors)` registry, expressed through the provider.
 *
 * The swatch row is the whole preview: eight slots in slot order, which is the thing being chosen.
 */
function SchemeSection() {
  const { resolvedAppearance, scheme, set } = useKanzoTheme();
  const entries = Object.entries(SCHEMES);
  if (entries.length < 2) return null;
  return (
    <PrefFieldSet label="Chart scheme">
      <RadioGroup
        className="gap-2"
        onValueChange={(d) => d.value && set({ scheme: d.value, schemeColors: undefined })}
        value={scheme ?? DEFAULT_PREFS.scheme}
      >
        {entries.map(([name, s]) => (
          <RadioGroupCard className="items-center gap-3 px-2 py-2" key={name} value={name}>
            <SwatchGroup colors={s[resolvedAppearance]} />
            <ArkRadioGroup.ItemText className="truncate text-muted-foreground text-xs">
              {s.label}
              {/* Said here rather than in a doc nobody opens: this scheme is legal but it owes the
                  chart a relief channel in this mode, and the reader is choosing it right now. */}
              {s.relief[resolvedAppearance] > 0 ? " · needs labels" : null}
            </ArkRadioGroup.ItemText>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </PrefFieldSet>
  );
}

/**
 * Palette = the colour IDENTITY, and now the panel's first and primary colour choice.
 *
 * It was also the only axis with no control: `data-palette` drives the surfaces, the neutrals, the
 * 13 syntax roles, `color-scheme`, `--primary`/`--ring`, the four status families, and `.dark`
 * follows from whichever palette applies — and until this section, only the OS could reach a second
 * one. A `RadioGroup`, not a `ColorPicker`: the value is a NAME, and the eight-slot strip pictures
 * it rather than being it (`swatch.tsx` states that distinction).
 *
 * The value is the APPLIED palette, not the stored preference. Under `system` those differ — the
 * stored "Kanzo" resolves to Kanzo Dark on a dark OS — and the card that reads as checked has to be
 * the one on screen. Selecting writes the preference, `set` pins the side, and the two agree again.
 *
 * Two facts the data publishes are said here rather than in a doc nobody opens, inside the option's
 * own text so the accessible name carries them (the shape `SchemeSection` uses for "· needs
 * labels"): a palette with no partner FIXES the appearance while selected, and non-empty
 * `relief`/`statusRelief` means slots that miss AA as text on that palette's own ground. Both are
 * properties of the palette, not defects of the mapping, so the honest move is to show them.
 */
function PaletteSection() {
  const { appearance, appliedPalette, palettePinned, set, setAppearance } = useKanzoTheme();
  const entries = Object.entries(PALETTES);
  if (entries.length < 2) return null;
  const applied = PALETTES[appliedPalette];
  return (
    <PrefFieldSet label="Palette">
      <RadioGroup
        className="gap-2"
        onValueChange={(d) => d.value && set({ palette: d.value })}
        value={appliedPalette}
      >
        {entries.map(([name, p]) => (
          <RadioGroupCard className="flex-col items-start gap-1.5 px-2.5 py-2" key={name} value={name}>
            <ArkRadioGroup.ItemText className="text-muted-foreground text-xs">
              {p.label}
              {p.pairsWith === null ? ` · ${p.appearance} only` : null}
              {p.relief.length || p.statusRelief.length ? " · low contrast" : null}
            </ArkRadioGroup.ItemText>
            <SwatchGroup colors={PALETTE_ACCENT_SLOTS.map((s) => p.slots[s])} size="md" />
          </RadioGroupCard>
        ))}
      </RadioGroup>
      {/* The appearance control is the header toggle, and it goes dead on a pinned palette by
          design — so the way back to the OS has to be reachable from the axis that took it. */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[length:var(--kanzo-font-size-small)] text-muted-foreground">
          {palettePinned
            ? `${applied?.label ?? appliedPalette} has no partner: appearance is fixed.`
            : appearance === "system"
              ? "Following the OS."
              : `Holding the ${appearance} side.`}
        </p>
        {appearance === "system" ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 text-muted-foreground"
            onClick={() => setAppearance("system")}
          >
            <MonitorIcon />
            Follow the OS
          </Button>
        )}
      </div>
    </PrefFieldSet>
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

/** Base = the whole NEUTRAL canvas (background, surfaces, borders, muted, sidebar). Unlike accent
 *  (a single brand hue), a base is a full 50→950 RAMP, so the picker offers the curated scales as
 *  preset swatches AND lets you pick any colour to TINT the neutral ramp toward it (→ a bespoke
 *  tinted grey, exactly like mauve/olive/…). Picking a preset hex selects the named scale; any
 *  other colour sets a `baseTint`. */
function BaseSection() {
  const { base = "neutral", baseTint, set } = useKanzoTheme();
  const value = baseTint ?? BASE_SWATCHES[base] ?? BASE_SWATCHES.neutral;
  return (
    <PrefField label="Base · neutral surface">
      <ColorField
        value={value}
        presets={presetsOf(BASE_SWATCHES)}
        presetsLabel="Base presets"
        onValueChange={(hex) => {
          const named = BASE_HEX_TO_NAME[hex.toLowerCase()];
          if (named) set({ base: named, baseTint: undefined });
          else set({ baseTint: hex });
        }}
      />
      <p className="mt-1.5 text-[length:var(--kanzo-font-size-small)] text-muted-foreground">
        Presets pick a curated scale; any other colour tints the neutral ramp.
      </p>
    </PrefField>
  );
}

// ── Copy theme — assembles the full :root/.dark CSS export for the current selection.
//    Mirrors EXACTLY what the provider applies live: a custom `primary` overrides the accent
//    preset (foreground derived by luminance), and non-default font / mono / density are emitted. ──
type TokenMap = Record<string, string>;
function buildThemeCss(prefs: ThemePrefs): string {
  const { base = "neutral", accent, radius, primary, baseTint, font, monoFont, density, palette, scheme, schemeColors } = prefs;
  const d = themeData as unknown as {
    bases: Record<string, { light: TokenMap; dark: TokenMap }>;
    accents: Record<string, { light: TokenMap; dark: TokenMap }>;
    radii: Record<string, string>;
    fonts: Record<string, string>;
    monoFonts: Record<string, string>;
    densities: Record<string, string>;
    staticLight: TokenMap;
    staticDark: TokenMap;
  };
  // A custom base tint resolves through the generated `custom` scale, whose `--color-custom-*`
  // shades we inline (they mix against `--color-neutral-*`, defined by Tailwind's preflight).
  const b = d.bases[baseTint ? "custom" : base]!;
  const customBase: TokenMap = baseTint ? customBaseVars(baseTint) : {};
  const a = d.accents[accent]!;
  // A custom primary hex replaces the accent preset in BOTH schemes (appearance-independent).
  const primaryVars: TokenMap | null = primary
    ? {
        "--primary": primary,
        "--primary-foreground": readableForeground(primary),
        "--ring": primary,
        "--sidebar-primary": primary,
        "--sidebar-primary-foreground": readableForeground(primary),
        "--sidebar-ring": primary,
      }
    : null;
  // Appearance-independent extras (only when non-default) — font-size drives density.
  const extras: TokenMap = {};
  if (font && font !== "system" && d.fonts[font]) extras["--font-sans"] = d.fonts[font];
  if (monoFont && monoFont !== "system" && d.monoFonts[monoFont]) extras["--font-mono"] = d.monoFonts[monoFont];
  if (density && density !== "default" && d.densities[density]) extras["font-size"] = d.densities[density];

  // The categorical scheme, emitted as literal slots in both blocks. It has to be here: it is the
  // one colour axis a copied theme used to lose entirely, because it was a static block rather than
  // something anyone chose. `schemeColors` (the runtime registry) wins over the named scheme, the
  // same precedence the provider applies.
  const slots = schemeColors ?? SCHEMES[scheme ?? DEFAULT_PREFS.scheme!];
  const chart = (mode: "light" | "dark"): TokenMap =>
    Object.fromEntries((slots?.[mode] ?? []).map((hex, i) => [`--chart-${i + 1}`, hex]));

  // The palette, for the same reason the scheme is here and with far more at stake: it is the
  // LARGEST colour axis — 51 tokens, every surface, the brand, the four status families, the 13
  // syntax roles and `color-scheme` — and a copied theme used to lose all of it. `Palette.vars` is
  // documented as exactly what `[data-palette]` sets, so this copies that rule rather than
  // re-deriving it.
  //
  // Per SIDE, not once: `:root` takes the light half of the pair and `.dark` the dark half, which is
  // the question `resolvePalette` already answers. A palette with no partner returns itself for
  // both — that IS pinning, spelled out in CSS.
  //
  // Nothing is emitted at the default palette, mirroring `AXES`: the provider REMOVES the attribute
  // there, so the block genuinely does not exist on the page and `data-base`/`data-accent` are what
  // the reader saw. Emitting it anyway would export a `--ring` the panel never showed.
  const paletteVars = (mode: "light" | "dark"): TokenMap => {
    const applied = resolvePalette(palette ?? DEFAULT_PREFS.palette, mode);
    return applied === DEFAULT_PREFS.palette ? {} : PALETTES[applied]?.vars ?? {};
  };

  const fmt = (o: TokenMap) => Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  // Order is the live cascade, flattened. `[data-palette]` is written with a doubled selector and
  // sits last in themes.css, so it beats base and accent; the inline `--primary` override beats
  // even that, so it is re-applied after the palette rather than only in the accent's place.
  const root = { ...customBase, "--radius": d.radii[radius]!, ...b.light, ...(primaryVars ?? a.light), ...d.staticLight, ...paletteVars("light"), ...(primaryVars ?? {}), ...chart("light"), ...extras };
  const dark = { ...b.dark, ...(primaryVars ?? a.dark), ...d.staticDark, ...paletteVars("dark"), ...(primaryVars ?? {}), ...chart("dark") };
  return `:root {\n${fmt(root)}\n}\n\n.dark {\n${fmt(dark)}\n}\n`;
}

/** Editor affordance: copy the current theme as a paste-ready :root/.dark CSS block. */
function CopyTheme({ className }: { className?: string } = {}) {
  const theme = useKanzoTheme();
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("w-full", className)}
      onClick={() => {
        void navigator.clipboard?.writeText(buildThemeCss(theme));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : "Copy CSS"}
    </Button>
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
    Palette: PaletteSection,
    Accent: AccentSection,
    Radius: RadiusSection,
    Font: FontSection,
    MonoFont: MonoFontSection,
    Density: DensitySection,
    Base: BaseSection,
    Scheme: SchemeSection,
    CopyTheme: CopyTheme,
  },
);

/**
 * The same parts as flat named exports.
 *
 * Prefer these. The `Preferences.X` namespace above is built with `Object.assign`, and those
 * statics do NOT survive React Server Components: once the module becomes a client reference,
 * `Preferences.Accent` reads back as `undefined` and React throws "Element type is invalid".
 * Flat exports cross the boundary intact, tree-shake per part, and match how every other
 * compound component in this library is exported (`DialogContent`, not `Dialog.Content`).
 */
export {
  PreferencesRoot,
  PreferencesTrigger,
  PreferencesPanel,
  PrefField as PreferencesField,
  PrefFieldSet as PreferencesFieldSet,
  PaletteSection as PreferencesPalette,
  AccentSection as PreferencesAccent,
  RadiusSection as PreferencesRadius,
  FontSection as PreferencesFont,
  MonoFontSection as PreferencesMonoFont,
  DensitySection as PreferencesDensity,
  BaseSection as PreferencesBase,
  // Missing until now, which made the panel's own doc ("every section is exported flat") false and
  // left the scheme section reachable only as `Preferences.Scheme` — a static that reads back
  // `undefined` across the RSC boundary, as the note above says.
  SchemeSection as PreferencesScheme,
  CopyTheme as PreferencesCopyTheme,
};
