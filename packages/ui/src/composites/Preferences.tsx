"use client";

import * as React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { InfoIcon, PaletteIcon, XIcon } from "lucide-react";
// Via the theme package's JS entry, not its raw `.json` subpath: a direct JSON subpath import
// needs `with { type: "json" }` at runtime, and Rollup strips that attribute when bundling.
import {
  DEFAULT_PREFS,
  prefBoolean,
  prefNumber,
  themeData,
  type KanzoRadius,
  type SectionPrefDecl,
} from "@kanzo-tech/theme";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";
import { cn } from "../lib/cn.js";
import { AppearanceToggle } from "./AppearanceToggle.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
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
import { Switch } from "../simples/switch.js";

/**
 * Preferences — a live theming selector (composite) for PRODUCT settings. A non-modal drawer
 * (metadata-form's UX) that drives {@link useKanzoTheme}, which writes `data-*` attributes to
 * `<html>` and toggles `.dark`, so every component re-skins with no changes. The default panel is
 * the canonical product set:
 *
 *   <Preferences.Root>
 *     <Preferences.Trigger />
 *     <Preferences.Panel>
 *       <Preferences.Colour /> <Preferences.Density /> <Preferences.Radius />
 *       <Preferences.Font /> <Preferences.MonoFont />
 *     </Preferences.Panel>
 *   </Preferences.Root>
 *
 * or the all-in-one <Preferences />. Those five sections ARE the default panel body, plus a footer
 * of Reset · Done. Open with `t`, close with Escape.
 *
 * **No colour is AUTHORED here.** A tenant's identity is a palette DOCUMENT — derived and measured
 * once at onboarding, compiled to one stylesheet the server inlines — not something a user picks a
 * hue at a time. Palette, accent, base, chart scheme and the "Copy CSS" export all left with it;
 * what the export did belongs on the onboarding surface, which has a document to emit.
 *
 * `Colour` is not that coming back. It chooses among the things the TENANT published — the same kind
 * of choice `appearance` makes between one document's two modes, one level up — and it shows itself
 * only when there are two to choose from.
 *
 * **Appearance is not here either**, and that is a different argument: it is still a preference,
 * but it already has a control. `AppearanceToggle` flips both of its states in one click, in the
 * chrome, where a one-click preference belongs. A section here would be the same preference
 * wearing a second control — the duplication this panel keeps removing everywhere else.
 *
 * It has two states and not three: "follow the OS" is `null`, the absence of a pinned side, so the
 * way back to it is `Reset` — which spreads `DEFAULT_PREFS` and therefore unpins appearance along
 * with everything else. That is the one thing this panel's footer does that no other control can.
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
            // `w-96`, not `w-80`. The width was chosen when the panel held four axes and a colour
            // strip; it now holds five sections plus however many the packages a host installed
            // contribute, and it is the one surface here that grows with somebody else's decision.
            // The extra 64px is what lets a palette card depict a document rather than gesture at
            // one — see `PalettePreview`.
            "pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-96 flex-col overflow-hidden",
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
                {/* Colour first, and ONE section: a palette and a brand are one choice at two
                    grains, so the panel offers one list and everything below it is a different axis
                    entirely. It renders nothing until the tenant published two choices, so the
                    common panel is unchanged. */}
                <ColorSection />
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
  const { set } = useKanzoTheme();
  // The defaults, spread — not a hand-copy of them. The hand-copy this replaced listed axes by
  // name and had silently stopped covering the panel more than once.
  const reset = () => set({ ...DEFAULT_PREFS });
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
/**
 * COLOUR — every choice the tenant published, as one list.
 *
 * **A palette and an identity are one abstraction with a parameter: how much of the document the
 * choice replaces.** An identity replaces the brand-derived slice and inherits every surface; a
 * palette replaces all of it. They always shared this control, this option type, the hide-below-two
 * rule and the retirement machinery — and the giveaway was the behaviour: changing palette *files and
 * restores* the identity, which is what containment does and what two sibling axes never would.
 *
 * So the panel shows one list. A palette that publishes several brands contributes one entry per
 * brand — `Bank · Retail`, `Bank · Private` — which is how VS Code and Slack present variants, and
 * which matches what the user is actually doing: making one choice. The model keeps the containment,
 * because that is what guarantees a tenant's brands share a neutral and stay one product.
 *
 * The prefix appears only when there is more than one palette to disambiguate against: a client with
 * a single palette and two brands sees `Retail` and `Private`, not their own name twice.
 */
export interface PreferencesColorProps {
  /** The legend, and one of the section's two library-authored strings (i18n). */
  label?: string;
  /** Heading of the notice shown when the tenant withdrew what this user had chosen. */
  retiredTitle?: string;
  /** Compose that notice's body. The argument is the retired **id**; its label went with it. */
  formatRetired?: (parts: { choice: string }) => string;
}

const DEFAULT_RETIRED_TITLE = "Colours updated";
const DEFAULT_RETIRED = ({ choice }: { choice: string }) =>
  `The colours you had chosen (${choice}) are no longer published, so these are the default ones.`;

/** `palette` on its own, or `palette/identity` when the palette publishes more than one brand. */
const KEY_SEPARATOR = "/";

/**
 * One palette, drawn by ITSELF — a miniature of the interface rather than a list of its hexes.
 *
 * **Nothing here is data.** The document is already in the page, compiled under its own
 * `[data-palette]`, so this span sets the attribute and every utility inside it resolves against
 * that document: `bg-primary` is that tenant's brand, `bg-chart-3` is their third categorical slot.
 * A strip of four hexes was the alternative and it could not depict a document — on Kanzo's own,
 * `--primary` and `--foreground` are the same value (the relief rule puts the fill on the ramp's
 * ink), so two of the four chips were one colour and the control said nothing.
 *
 * **The appearance class is not optional.** `compile`'s scoped selectors are
 * `[data-palette="x"]`, `[data-palette="x"].light` and `[data-palette="x"].dark` — never
 * `.dark [data-palette="x"]` — precisely so a preview can force a side inside a page painted the
 * other way. Without the class this span would take the light block on a dark page.
 *
 * **The default palette carries no attribute, and that is the case that does not fit.** Its
 * document *is* `tokens.css`, emitted at `:root, .light` / `.dark` with no scope of its own, so
 * `[data-palette="kanzo"]` matches nothing and the cell would inherit whatever the page is wearing.
 * The class alone matches those blocks, and a declaration on this element beats an inherited value
 * whatever the specificity, so the default draws itself correctly even inside a Dracula page.
 *
 * The categorical strip draws all eight slots on purpose. Past a document's `capacity`, `compile`
 * writes `var(--muted-foreground)`, so a set that holds seven says so by going grey at the end.
 */
function PalettePreview({
  appearance,
  identity,
  palette,
}: {
  appearance: string;
  /** The brand within the document, or `""` for the one `:root` carries. */
  identity: string;
  /** The document's id, or `""` for the default — which has no scoped block to select. */
  palette: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-16 flex-col justify-between rounded-[4px] border border-border bg-background p-2",
        appearance,
      )}
      data-identity={identity || undefined}
      data-palette={palette || undefined}
      data-slot="palette-preview"
    >
      {/* Chrome: the brand fill, and two weights of ink on the page. */}
      <span className="flex items-center gap-1">
        <span className="h-2 w-4 rounded-[2px] bg-primary" />
        <span className="h-1 w-5 rounded-full bg-foreground" />
        <span className="h-1 flex-1 rounded-full bg-muted-foreground" />
      </span>

      {/* Two lines of code, indented — the half that makes the card true rather than decorative.
          A document derives seven syntax roles of its own, so Dracula's card paints Dracula's
          keywords; a card that stopped at surfaces and a brand would show six documents agreeing
          about the only part of themselves they share. This is the move GitHub's theme picker
          makes, and the reason it is the reference: the tile shows the thing being themed. */}
      <span className="flex flex-col gap-[3px] ps-1">
        <span className="flex items-center gap-[3px]">
          <span className="h-1 w-3 rounded-full bg-[var(--syntax-keyword)]" />
          <span className="h-1 w-5 rounded-full bg-[var(--syntax-function)]" />
          <span className="h-1 w-2 rounded-full bg-[var(--syntax-number)]" />
        </span>
        <span className="flex items-center gap-[3px] ps-2">
          <span className="h-1 w-4 rounded-full bg-[var(--syntax-property)]" />
          <span className="h-1 w-6 rounded-full bg-[var(--syntax-string)]" />
          <span className="h-1 w-2.5 rounded-full bg-[var(--syntax-type)]" />
        </span>
      </span>

      {/* The categorical set, all eight slots. Past a document's capacity `compile` writes
          `var(--muted-foreground)`, so a set that holds seven says so by going grey at the end. */}
      <span className="flex items-center gap-px">
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-1" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-2" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-3" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-4" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-5" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-6" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-7" />
        <span className="h-1.5 flex-1 rounded-[1px] bg-chart-8" />
      </span>
    </span>
  );
}

/**
 * Wear a palette while the pointer is on it, and put back exactly what was there.
 *
 * This is the reference behaviour — VS Code and Zed preview a theme as you arrow through the list,
 * and revert when you leave — and it is affordable here for one reason: every document the tenant
 * publishes is already in the page, so previewing is two attribute writes and no fetch, no
 * stylesheet swap and no re-render.
 *
 * **It restores a snapshot rather than recomputing what should be there.** The provider removes an
 * axis attribute at its default and sets it otherwise, so "put it back" has two spellings depending
 * on preferences this component would have to read and agree with. Reading the element on the way
 * in cannot disagree with anything.
 */
function usePalettePreview() {
  const held = React.useRef<{ palette: string | null; identity: string | null } | null>(null);

  const restore = React.useCallback(() => {
    const snapshot = held.current;
    if (!snapshot) return;
    held.current = null;
    const el = document.documentElement;
    for (const [attr, value] of [
      ["data-palette", snapshot.palette],
      ["data-identity", snapshot.identity],
    ] as const) {
      if (value === null) el.removeAttribute(attr);
      else el.setAttribute(attr, value);
    }
  }, []);

  const preview = React.useCallback(
    (palette: string, identity: string) => {
      const el = document.documentElement;
      // Only the FIRST entry into the list snapshots. Moving from one card to the next fires leave
      // and enter in an order the pointer decides, and re-snapshotting mid-sweep would file the
      // palette being previewed as the one to go back to.
      held.current ??= {
        palette: el.getAttribute("data-palette"),
        identity: el.getAttribute("data-identity"),
      };
      if (palette) el.setAttribute("data-palette", palette);
      else el.removeAttribute("data-palette");
      if (identity) el.setAttribute("data-identity", identity);
      else el.removeAttribute("data-identity");
    },
    [],
  );

  // A panel closed mid-preview — Escape, a click on the trigger — never fires the leave handler,
  // and would leave the reader wearing a palette they did not choose.
  React.useEffect(() => restore, [restore]);

  return { preview, restore };
}

function ColorSection({
  label = "Colour",
  retiredTitle = DEFAULT_RETIRED_TITLE,
  formatRetired = DEFAULT_RETIRED,
}: PreferencesColorProps = {}) {
  const {
    defaultPalette,
    palettes,
    resolvedAppearance,
    resolvedPalette,
    resolvedIdentity,
    retiredPalette,
    retiredIdentity,
    setPalette,
  } = useKanzoTheme();
  const { preview, restore } = usePalettePreview();

  const prefixed = palettes.length > 1;
  const entries = palettes.flatMap((palette) => {
    // The default document is emitted unscoped, so its preview selects on the appearance class
    // alone — see `PalettePreview`. Everywhere else this is the document's own id.
    const scope = palette.value === defaultPalette ? "" : palette.value;
    const brands = palette.children ?? [];
    if (brands.length < 2) {
      return [{ identity: "", key: palette.value, label: palette.label, scope }];
    }
    return brands.map((brand) => ({
      identity: brand.value,
      key: `${palette.value}${KEY_SEPARATOR}${brand.value}`,
      label: prefixed ? `${palette.label} · ${brand.label}` : brand.label,
      scope,
    }));
  });

  if (entries.length < 2) return null;

  const retired = retiredPalette ?? retiredIdentity;
  // The selection is a pair, so the checked entry is the pair — and it is read from the RESOLVED
  // values, not the preferences: an empty preference is a deferral to the document, and the entry
  // that reads as checked has to be the one on screen.
  const selected = entries.some((entry) => entry.key === resolvedPalette)
    ? resolvedPalette
    : `${resolvedPalette}${KEY_SEPARATOR}${resolvedIdentity}`;

  return (
    <PrefFieldSet label={label}>
      {/* A grid, because the list is the one section that grows with the tenant. Stacked at full
          width the five this site publishes took half the panel's scroll height and pushed every
          other axis below the fold; a client publishing a dozen would have owned the whole of it. */}
      <RadioGroup
        className="grid grid-cols-2 gap-2"
        onBlur={restore}
        onPointerLeave={restore}
        onValueChange={(d) => {
          if (!d.value) return;
          const [palette, identity = ""] = d.value.split(KEY_SEPARATOR);
          // The preview held the choice on <html> already; the snapshot it would restore is the
          // palette being left, so it has to be dropped before the write lands.
          restore();
          // One call, because it is one choice, and `setPalette` is what knows which side is being
          // written — a palette is chosen per appearance. It also files the outgoing brand under the
          // palette being left and would otherwise restore a remembered one over the top of this.
          setPalette(palette ?? "", identity);
        }}
        value={selected}
      >
        {entries.map((entry) => (
          <RadioGroupCard
            className="flex-col items-stretch gap-1.5 p-1.5"
            key={entry.key}
            onFocus={() => preview(entry.scope, entry.identity)}
            onPointerEnter={() => preview(entry.scope, entry.identity)}
            value={entry.key}
          >
            <PalettePreview
              appearance={resolvedAppearance}
              identity={entry.identity}
              palette={entry.scope}
            />
            <ArkRadioGroup.ItemText className="truncate text-muted-foreground text-xs">
              {entry.label}
            </ArkRadioGroup.ItemText>
          </RadioGroupCard>
        ))}
      </RadioGroup>
      {/* One notice for both, because there is one choice: whichever half the tenant withdrew, what
          the user lost is the colours they picked. No toast — a document is served, so the page they
          are reading is already the default one and nothing is about to change under them. */}
      {retired ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>{retiredTitle}</AlertTitle>
          <AlertDescription>{formatRetired({ choice: retired })}</AlertDescription>
        </Alert>
      ) : null}
    </PrefFieldSet>
  );
}

/**
 * One declared preference, drawn — the switch on `kind`, in one place.
 *
 * It is the only thing in this file that maps a declaration to a control, which is what lets a
 * second surface (the graph's own dock) render a contributed group without re-deciding what a
 * `range` looks like. The three arms reuse the same primitives the core's own sections use:
 * `choice` is the radio list `Colour` and `Density` use, `toggle` is `Switch`, `range` is `Slider`.
 *
 * A value is a string in storage for all three — see `SectionPrefDecl` — so each arm parses on the
 * way in with the section mechanism's own readers rather than a local `Number()` that would differ
 * from what the resolver validated against.
 */
function ContributedControl({
  name,
  onChange,
  pref,
}: {
  name: string;
  onChange: (next: string) => void;
  pref: { value: string; decl: SectionPrefDecl };
}) {
  const { decl, value } = pref;

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
      <PrefField label={name}>
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
        <SliderLabel className={cn(PREF_LABEL_SIZE, PREF_LABEL)}>{name}</SliderLabel>
      </Slider>
    );
  }

  return (
    <PrefFieldSet label={name}>
      <RadioGroup
        className="gap-2"
        onValueChange={(d) => d.value && onChange(d.value)}
        value={value}
      >
        {decl.options.map((option) => (
          <RadioGroupCard className="items-center px-2.5 py-2" key={option.value} value={option.value}>
            <ArkRadioGroup.ItemText className="text-xs">{option.label}</ArkRadioGroup.ItemText>
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
 * expresses is the one `Colour` and `Density` already express — pick one of these, they have names.
 */
function ContributedSections() {
  const { sectionPrefs, setSectionPref } = useKanzoTheme();

  return (
    <>
      {Object.entries(sectionPrefs).map(([namespace, prefs]) =>
        Object.entries(prefs).map(([key, pref]) =>
          pref.offered ? (
            <ContributedControl
              key={`${namespace}.${key}`}
              name={key}
              onChange={(next) => setSectionPref(namespace, key, next)}
              pref={pref}
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
 * single counter-example to CONVENTIONS.md's "no component exports dot-notation today".
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
  ColorSection as PreferencesColor,
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
