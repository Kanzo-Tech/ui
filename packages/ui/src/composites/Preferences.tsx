"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import { themeData, type KanzoBase, type KanzoRadius } from "@kanzo-tech/theme";
import { useKanzoTheme, type ThemePrefs } from "../theme/KanzoThemeProvider.js";
import { cn } from "../lib/cn.js";
import { customBaseVars, readableForeground } from "../lib/color.js";
import { Button } from "../simples/button.js";
import { Field, FieldLabel } from "../simples/field.js";
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
import { Slider } from "../simples/slider.js";
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
 *       <Preferences.Accent /> <Preferences.Base />
 *       <Preferences.Radius /> <Preferences.Font /> <Preferences.MonoFont />
 *       <Preferences.Density />
 *     </Preferences.Panel>
 *   </Preferences.Root>
 *
 * or the all-in-one <Preferences />. Those six sections ARE the default panel body (appearance is
 * the header toggle beside the close), plus a
 * footer of Reset · Copy CSS · Done. (This comment used to claim `Base` was opt-in and omitted
 * by default; the panel has rendered it for some time — the code is the authority.) Open with
 * `t`, close with Escape.
 */

const RADII: KanzoRadius[] = ["none", "xs", "sm", "md", "lg"];
// Curated base scales + a representative mid-tone (shade ~500) used as their ColorPicker swatch.
// Picking one of these exact hexes selects the NAMED scale; any other colour becomes a tint.
const BASE_PRESETS: { name: KanzoBase; hex: string }[] = [
  { name: "neutral", hex: "#737373" },
  { name: "slate", hex: "#64748b" },
  { name: "gray", hex: "#6b7280" },
  { name: "zinc", hex: "#71717a" },
  { name: "stone", hex: "#78716c" },
  { name: "mauve", hex: "#79697b" },
  { name: "olive", hex: "#7c7c67" },
  { name: "mist", hex: "#67787c" },
  { name: "taupe", hex: "#7c6d67" },
];
const BASE_HEX_TO_NAME: Record<string, KanzoBase> = Object.fromEntries(
  BASE_PRESETS.map((p) => [p.hex.toLowerCase(), p.name]),
);
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

  // Non-modal so the app stays interactive and re-skins live behind the panel;
  // `closeOnInteractOutside={false}` keeps it open while you click around the app.
  return (
    <Dialog open={open} onOpenChange={(e) => setOpen(e.open)} modal={false} closeOnInteractOutside={false}>
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
        // The `data-state` pair is load-bearing, not decoration. The panel is `modal={false}`
        // with `closeOnInteractOutside={false}`, so it stays open while you work elsewhere —
        // and without an open state on the trigger, nothing on screen says so. Ark's
        // Dialog.Trigger already emits `data-state="open"`, so this needs no extra state.
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
                <AccentSection />
                <BaseSection />
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
  const reset = () =>
    set({
      accent: "neutral",
      radius: "md",
      font: "system",
      monoFont: "system",
      density: "default",
      base: "neutral",
      primary: undefined,
    });
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
      <FieldLabel className="text-[length:var(--kanzo-font-size-small)] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────
/** The shared colour-picker control (Shark's, controlled) used by BOTH accent and base:
 *  a trigger swatch + value, and a popover with area/hue/hex + a row of preset swatches. */
function ColorField({
  value,
  onValueChange,
  presets,
}: {
  value: string;
  onValueChange: (hex: string) => void;
  presets: string[];
}) {
  return (
    <ColorPicker value={value} onValueChange={(e) => onValueChange(e.valueAsString)} className="w-full">
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
        <ColorPickerSwatchGroup>
          {presets.map((h) => (
            <ColorPickerSwatchTrigger key={h} value={h}>
              <ColorPickerSwatch value={h}>
                <ColorPickerSwatchIndicator />
              </ColorPickerSwatch>
            </ColorPickerSwatchTrigger>
          ))}
        </ColorPickerSwatchGroup>
        <ColorPickerInput />
      </ColorPickerContent>
    </ColorPicker>
  );
}

// Curated accent presets as concrete colours for the ColorPicker's swatch row.
const ACCENT_PRESETS = ["#525252", "#2563eb", "#16a34a", "#7c3aed", "#ea580c", "#e11d48"];

/** Accent = a real colour picker: curated swatches + custom area/hex. Picking sets a custom
 *  `--primary` (foreground derived); the picker is the reference way. */
function AccentSection() {
  const { primary, set } = useKanzoTheme();
  return (
    <PrefField label="Accent">
      <ColorField value={primary ?? "#2563eb"} onValueChange={(hex) => set({ primary: hex })} presets={ACCENT_PRESETS} />
    </PrefField>
  );
}

function RadiusSection() {
  const { radius, set } = useKanzoTheme();
  const index = Math.max(0, RADII.indexOf(radius));
  return (
    <PrefField label="Radius">
      <Slider
        aria-label={["Radius"]}
        min={0}
        max={RADII.length - 1}
        step={1}
        value={[index]}
        onValueChange={(d) => set({ radius: RADII[d.value[0] ?? 3] ?? "md" })}
        showMarkers
        markerLabels={[...RADII]}
      />
    </PrefField>
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
    <RadioGroup
      aria-label="Font"
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
    <PrefField label="Font">
      <FontPicker value={font} options={fonts} onSelect={(v) => set({ font: v })} />
    </PrefField>
  );
}

function MonoFontSection() {
  const { monoFont, monoFonts, set } = useKanzoTheme();
  return (
    <PrefField label="Mono font">
      <FontPicker value={monoFont} options={monoFonts} onSelect={(v) => set({ monoFont: v })} />
    </PrefField>
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
    <PrefField label="Density">
      <RadioGroup
        aria-label="Density"
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
    </PrefField>
  );
}

/** Base = the whole NEUTRAL canvas (background, surfaces, borders, muted, sidebar). Unlike accent
 *  (a single brand hue), a base is a full 50→950 RAMP, so the picker offers the curated scales as
 *  preset swatches AND lets you pick any colour to TINT the neutral ramp toward it (→ a bespoke
 *  tinted grey, exactly like mauve/olive/…). Picking a preset hex selects the named scale; any
 *  other colour sets a `baseTint`. */
function BaseSection() {
  const { base = "neutral", baseTint, set } = useKanzoTheme();
  const value = baseTint ?? BASE_PRESETS.find((p) => p.name === base)?.hex ?? "#737373";
  return (
    <PrefField label="Base · neutral surface">
      <ColorField
        value={value}
        presets={BASE_PRESETS.map((p) => p.hex)}
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
  const { base = "neutral", accent, radius, primary, baseTint, font, monoFont, density } = prefs;
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

  const fmt = (o: TokenMap) => Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  const root = { ...customBase, "--radius": d.radii[radius]!, ...b.light, ...(primaryVars ?? a.light), ...d.staticLight, ...extras };
  const dark = { ...b.dark, ...(primaryVars ?? a.dark), ...d.staticDark };
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
    Accent: AccentSection,
    Radius: RadiusSection,
    Font: FontSection,
    MonoFont: MonoFontSection,
    Density: DensitySection,
    Base: BaseSection,
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
  AccentSection as PreferencesAccent,
  RadiusSection as PreferencesRadius,
  FontSection as PreferencesFont,
  MonoFontSection as PreferencesMonoFont,
  DensitySection as PreferencesDensity,
  BaseSection as PreferencesBase,
  CopyTheme as PreferencesCopyTheme,
};
