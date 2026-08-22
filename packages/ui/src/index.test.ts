import { describe, expect, it } from "vitest";
import * as UI from "./index";

/**
 * What `import { … } from "@kanzo-tech/ui"` is allowed to find, and what it must not.
 *
 * Two halves, and the second is the one that earns the file. The positive half is a smoke test with
 * a purpose: an `export *` barrel resolves at runtime, so a module that fails to load, a name two
 * modules both export — which silently exports neither — and a compound whose statics do not
 * survive React Server Components are all invisible to `tsc` and visible here. The negative half is
 * the tombstones: names asserted **absent**, each with the argument that removed it written beside
 * it. A deletion whose reasoning lives only in a commit message comes back; a deletion with a
 * failing test in front of it does not. That is why `MetricCard`, `Fieldset`, `SidebarNav` and the
 * rest are still named in a file about a surface they are not on — and why the one-way doors
 * CLAUDE.md lists, the optional peers that must stay off the root barrel, are asserted rather than
 * trusted: a static import of `@codemirror/*` from `index.tsx` breaks `import { Button }` for
 * everyone who did not install it.
 *
 * ## It is an enumeration, not a pin
 *
 * Read the assertions rather than the reputation. There is no `Object.keys(UI)` comparison and no
 * snapshot anywhere below — 141 names asserted present and 63 asserted absent (counted 2026-07-30),
 * every one typed out by hand. So **adding** an export never fails this file, and **removing** one
 * fails only if somebody had already written that name down. `Table` is the worked example: ours,
 * and `@tanstack/react-table`'s as well, and it appears in neither list here, so deleting it would
 * leave this green.
 *
 * The guard that does catch a silent deletion is `shark-parity.test.ts`, for every name the
 * reference also ships. `ships every name Shark ships, or declares why not` goes red when a name
 * leaves one of our `simples/` modules; `puts every adopted module's exports on the public barrel`
 * goes red when it leaves the barrel while staying in its module. Between them they hold the
 * majority of the surface — but not a name that is ours alone, and not `composites/` or `layouts/`,
 * which are outside that file's corpus. There, this enumeration is the only thing there is.
 *
 * ## What this guard cannot prove
 *
 * - **Nothing about the built artefact.** It imports `./index`, which is source. `docs/` resolves
 *   the package to `dist/`, which is how a rename typechecks clean and breaks the docs build.
 *   `documented-exports.test.ts` is the file that reads the emitted `.d.ts`; `pnpm smoke` is the
 *   one that installs the tarball without the optional peers.
 * - **Nothing about shape.** `toBeTypeOf("function")` is satisfied by any function. A component
 *   that renders nothing, a hook that throws, a recipe whose variant keys were all renamed — each
 *   passes. The one binding checked by identity rather than by type is checked in
 *   `shark-parity.test.ts`, not here.
 * - **Nothing about types.** `export type` contributes no runtime binding, so the entire type
 *   surface is outside this file by construction.
 * - **Nothing about the subpaths.** The three `keeps … off the root barrel` tests assert absence
 *   from the root and never import `/editor`, `/table` or `/analytics`. A name deleted from a
 *   subpath satisfies them by being absent, which is precisely what they ask for.
 * - **It cannot tell a tombstone from a name nobody has written yet.** `expect(surface.X)
 *   .toBeUndefined()` reads the same for both, so a tombstone whose reason has expired looks like
 *   every other line. The comment above each is the only thing carrying that reason, and nothing
 *   checks it — unlike `shark-parity.divergences.ts`, where a declaration that has stopped
 *   describing a difference fails.
 */
describe("@kanzo-tech/ui public surface", () => {
  it("exposes the core surface", () => {
    expect(UI.Button).toBeTypeOf("function");
    expect(UI.Preferences).toBeTypeOf("function");
    expect(UI.KanzoThemeProvider).toBeTypeOf("function");
    expect(UI.useKanzoTheme).toBeTypeOf("function");
    expect(UI.themeScript).toBeTypeOf("function");
    expect(UI.ButtonGroup).toBeTypeOf("function");
    expect(UI.NumberInput).toBeTypeOf("function");
    expect(UI.Item).toBeTypeOf("function");
    // Adopted the day it got its second renderer — the graph inspector and the field-notes slip
    // panel had both hand-written its `dl`. Its UNADOPTED entry in `shark-parity.divergences.ts`
    // is gone, which is the assertion that would go red if this left the barrel again.
    expect(UI.DataList).toBeTypeOf("function");
    expect(UI.DataListItem).toBeTypeOf("function");
    expect(UI.DataListItemLabel).toBeTypeOf("function");
    expect(UI.DataListItemValue).toBeTypeOf("function");
    // Adopted for the same reason and in the same place: the Field notes slip pane could show a
    // reader where a row came from and gave them no way to disagree with it. `useImageCropper` is the
    // context hook here rather than Shark's machine hook — `simples/image-cropper.test.tsx` is
    // where that binding is pinned, because a name comparison cannot see it.
    expect(UI.ImageCropper).toBeTypeOf("function");
    expect(UI.ImageCropperImage).toBeTypeOf("function");
    expect(UI.ImageCropperSelection).toBeTypeOf("function");
    expect(UI.ImageCropperHandle).toBeTypeOf("function");
    expect(UI.ImageCropperGrid).toBeTypeOf("function");
    expect(UI.useImageCropper).toBeTypeOf("function");
    expect(UI.Float).toBeTypeOf("function");
    expect(UI.ClientOnly).toBeTypeOf("function");
    expect(UI.DownloadTrigger).toBeTypeOf("function");
    expect(UI.Show).toBeTypeOf("function");
    expect(UI.JsonTreeView).toBeTypeOf("function");
    expect(UI.Listbox).toBeTypeOf("function");
    // The one primitive Ark cannot supply for colour: a strip that only *depicts*. Ark's swatch
    // parts all require a picker context and compute `checked` against its single value, so a
    // sixteen-slot palette strip cannot be built from them.
    expect(UI.Swatch).toBeTypeOf("function");
    expect(UI.SwatchGroup).toBeTypeOf("function");
  });

  it("can build every value its machines demand, from the barrel alone", () => {
    // A machine whose value cannot be constructed from the barrel is not usable from the barrel.
    // `Select`/`Combobox` take a collection; `DatePicker` takes a `DateValue[]`, and the ISO
    // adapter that used to build one went with `DateField`. Both helpers are re-exported here so
    // a consumer never needs a direct `@ark-ui/react` or `@internationalized/date` dependency.
    expect(UI.createListCollection).toBeTypeOf("function");
    expect(UI.parseDate).toBeTypeOf("function");
    expect(UI.parseDate("2026-07-31").toString()).toBe("2026-07-31");
  });

  it("exposes the one facet-filter surface, on the root barrel", () => {
    // Both consumers sit on subpaths that must not import each other — `/table` would pull in
    // Mosaic, `/analytics` would pull in TanStack. FacetFilter is presentational, so the root
    // barrel is the only place it can serve both. It is built on `Listbox`, not on `Menu`:
    // a filter is a value, so its surface is a listbox (DESIGN.md, admission rules).
    expect(UI.FacetFilter).toBeTypeOf("function");
    expect(UI.ListboxItem).toBeTypeOf("function");
    // The filter field `searchable` draws. An Ark part Shark's listbox omits, so nothing upstream
    // would notice it going missing.
    expect(UI.ListboxInput).toBeTypeOf("function");
    // `ListboxShortcut` was the one name in this file's set that had to be *written* rather than
    // un-hidden: a third `data-slot` rename of `MenuShortcut`'s span, with no renderer here, deleted
    // on admission rule 2. Shark's `listbox.tsx` exports it, and a house principle does not overrule
    // the reference — `decisions/a-house-principle-withholds-no-name.md`.
    expect(UI.ListboxShortcut).toBeTypeOf("function");
  });

  it("exposes two themers, and they are not interchangeable", () => {
    // `KanzoTheme` was deleted once, and the reason it went is worth keeping because it is still
    // half true: it sets the attributes on a wrapper `<div>`, so it cannot theme Ark's portalled
    // overlays, and beside the real provider it gave callers no way to tell which was which — a
    // repo-wide grep found zero JSX usages and one working provider.
    //
    // What changed is the half that was not about portals. A scope could not paint a different
    // palette at all while a document was a whole stylesheet the server picked: there was no block
    // for an attribute to select, so the component's only real power was over the non-colour axes.
    // `compile(doc, { scope })` emits one document per attribute now, and the five ship together, so
    // a palette gallery — five documents on one page — is a thing that can exist.
    //
    // The ambiguity is answered by documentation and by a test rather than by deletion:
    // `KanzoTheme.test.tsx` asserts the portal limit directly, so "not the chrome of an app" is a
    // measured property and not a warning someone has to remember to read.
    const surface = UI as Record<string, unknown>;
    expect(surface.KanzoTheme).toBeTypeOf("function");
    expect(surface.KanzoThemeProvider).toBeTypeOf("function");
  });

  it("drops components superseded by composition or a merge", () => {
    // MetricCard → a Card+Skeleton showcase composition; SecretField → folded into password-input
    // (an API key is a password). Neither is a library export any more.
    const surface = UI as Record<string, unknown>;
    expect(surface.MetricCard).toBeUndefined();
    expect(surface.SecretField).toBeUndefined();
    // SuggestMenu dissolved into a Popover + useSuggestions composition.
    expect(surface.SuggestMenu).toBeUndefined();
    // `AppearanceToggle` was a second control for a preference `PreferencesColor` already offers:
    // that section draws one card per side and pressing a card wears it, so the sun/moon button in
    // the panel header asked the same question a second time, twelve pixels away. It cycled nothing
    // — "follow the OS" is `""` and its way back is Reset — so what went with it is the button, not
    // a state. What went with it that this file cannot see: where the tenant published fewer than
    // two choices `PreferencesColor` returns null, and that panel now has no appearance control.
    expect(surface.AppearanceToggle).toBeUndefined();
    // The AiAssist provider was over-engineered for one consumer, and a `complete` prop plus the
    // monolithic FieldSuggest violated core purity. AI-assist became two composed compounds —
    // `Complete` (over a pure Input/Textarea) and `Suggest` — with the engine hooks headless.
    expect(surface.AiAssist).toBeUndefined();
    expect(surface.useAiField).toBeUndefined();
    expect(surface.useAiFieldOptional).toBeUndefined();
    expect(surface.FieldSuggest).toBeUndefined();
    // And then the two compounds and the engine left this package entirely, for
    // `@kanzo-tech/ai` — `decisions/the-ai-surfaces-are-their-own-package.md`. The test that
    // matters is not that they are gone but that NOTHING here depends on them: a barrel that
    // still reached for `useInlineCompletion` would make `ui` depend on `ai`, and `ai` already
    // depends on `ui`.
    for (const name of [
      "useAiStream", "useInlineCompletion", "useSuggestions", "cleanGhost",
      "CompleteRoot", "CompleteTextarea", "CompleteGhost", "CompleteHint",
      "SuggestRoot", "SuggestTrigger", "SuggestContent",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    // `Fieldset` and `FieldSet` wrapped the same `ArkFieldset.Root` and differed by one capital
    // letter, with a doc page each teaching it in near-identical sentences. `FieldSet` won — six
    // consumers to one, and a `variant` prop `FieldsetLegend` hardcoded. The fieldset-*scoped*
    // messages were the only thing `field.tsx` lacked, and they survive as `FieldSetHelper` /
    // `FieldSetError`: a different Ark machine from `FieldHelper` / `FieldError`, not a copy.
    expect(surface.Fieldset).toBeUndefined();
    expect(surface.FieldsetLegend).toBeUndefined();
    expect(surface.FieldsetHelperText).toBeUndefined();
    expect(surface.FieldsetErrorText).toBeUndefined();
    expect(surface.useFieldset).toBeUndefined();
    expect(UI.FieldSetHelper).toBeTypeOf("function");
    expect(UI.FieldSetError).toBeTypeOf("function");
    // `context-menu.tsx` paid ten exports for rung 2 of the ladder: nine were `data-slot` renames
    // of `Menu`'s parts and the tenth was the only real one. A context menu is the same `Menu` with
    // a different trigger, which is what `menu.mdx` already said.
    expect(surface.ContextMenu).toBeUndefined();
    expect(surface.ContextMenuItem).toBeUndefined();
    expect(surface.ContextMenuTrigger).toBeUndefined();
    expect(surface.ContextMenuShortcut).toBeUndefined();
    expect(surface.useContextMenu).toBeUndefined();
    expect(UI.MenuContextTrigger).toBeTypeOf("function");
    // `CardRadioGroup` was rung-1 layout plus an `options: ReactNode[]` array over a compound that
    // already existed. The grid moved onto `RadioGroup` as a `columns` prop; the cards are
    // `RadioGroupCard`, which is what a card radio always was.
    expect(surface.CardRadioGroup).toBeUndefined();
    expect(UI.RadioGroupCard).toBeTypeOf("function");
    expect(surface.SectionNav).toBeUndefined();
  });

  it("drops the components that took a layout tree as an array prop", () => {
    // The rule `SidebarIdentity.tsx` states in full: if a prop's value is markup, it is children.
    // A record or array of `ReactNode`s is a layout tree written as an attribute — you cannot
    // reorder it, wrap a region, spread `className`/`data-*`/a handler onto one entry, or use
    // `asChild` on one. All five failed it, and their parts all ship.
    const surface = UI as Record<string, unknown>;
    // `SidebarNav`'s items were TWO levels deep with `title: string`, so a caller could not bold a
    // word. `SectionNav` was already merged into it; both are gone. A nav column is `SidebarMenu`
    // + `SidebarMenuButton asChild`, and the one non-obvious part is exported as `isActivePath`.
    expect(surface.SidebarNav).toBeUndefined();
    expect(surface.SidebarNavItem).toBeUndefined();
    expect(UI.isActivePath).toBeTypeOf("function");
    // `SidebarUser` and `InstanceSwitcher` were one component under two names — byte-identical
    // trigger, identity row, menu body and comments. `SidebarUser.user` was *literally* the
    // `label`/`description`/`avatarUrl` record `SidebarIdentity` names as the shape it rejects,
    // and `separatorBefore: boolean` was the confession: a separator between children, in a shape
    // with no children to put one between.
    expect(surface.SidebarUser).toBeUndefined();
    expect(surface.InstanceSwitcher).toBeUndefined();
    expect(UI.SidebarIdentity).toBeTypeOf("function");
    expect(UI.Menu).toBeTypeOf("function");
    // `Breadcrumbs` had to invent `BreadcrumbEntry` because `BreadcrumbItem` was taken. A component
    // that forces a synonym for an existing concept is evidence against itself. Its `min-w-0` moved
    // onto the primitive; the collapse is a hand-composed example, which is how Shark ships it.
    expect(surface.Breadcrumbs).toBeUndefined();
    expect(UI.Breadcrumb).toBeTypeOf("function");
    expect(UI.BreadcrumbEllipsis).toBeTypeOf("function");
    // `MadeWith` hard-coded the English "Made with"/"at" and defaulted `by` to the brand name
    // "Kanzo", in a library whose first admission rule is domain-freedom.
    expect(surface.MadeWith).toBeUndefined();
    // The routing seam for all five. `asChild` on the part that renders the anchor reaches every
    // part, not just the one a `linkComponent` prop was wired to — and `DefaultLink` was a second
    // component emitting `data-slot="link"`, against `Link`, which is the styled one.
    expect(surface.DefaultLink).toBeUndefined();
    expect(UI.Link).toBeTypeOf("function");
  });

  it("drops the pre-arrangements over parts that already ship", () => {
    const surface = UI as Record<string, unknown>;
    // `EmptyState` was `icon`/`title`/`description`/`action` as four `ReactNode` props over a raw
    // `<div>` — no `ark.*`, no recipe. `Item` and its parts compose to exactly this.
    expect(surface.EmptyState).toBeUndefined();
    expect(UI.Item).toBeTypeOf("function");
    expect(UI.ItemMedia).toBeTypeOf("function");
    expect(UI.ItemTitle).toBeTypeOf("function");
    expect(UI.ItemDescription).toBeTypeOf("function");
    expect(UI.ItemActions).toBeTypeOf("function");
    // `Ribbon`'s whole render was `<div class="relative">{children}<Float><Badge/></Float></div>`.
    expect(surface.Ribbon).toBeUndefined();
    expect(UI.Float).toBeTypeOf("function");
    expect(UI.Badge).toBeTypeOf("function");
    // `TextField`'s `iconStart`/`iconEnd` were named regions as attributes over `InputGroup` +
    // `InputGroupAddon`. It also used the forbidden `forwardRef`.
    expect(surface.TextField).toBeUndefined();
    expect(UI.InputGroup).toBeTypeOf("function");
    expect(UI.InputGroupAddon).toBeTypeOf("function");
    expect(UI.InputGroupInput).toBeTypeOf("function");
    // `NumberField` was `TextField type="number"` — rung 1 of the ladder minted as a component,
    // shadowing the Ark machine with the friendlier name and none of its steppers, scrubber,
    // format or clamping. `type="number"` is the input everybody advises against.
    expect(surface.NumberField).toBeUndefined();
    expect(UI.NumberInput).toBeTypeOf("function");
    // `DateField` pre-arranged `DatePicker` plus nine `Calendar*` parts and took no `className`,
    // no `ref`, no `...rest`, no `id`/`name`/`aria-*` — strictly less capable than the parts.
    expect(surface.DateField).toBeUndefined();
    expect(UI.DatePicker).toBeTypeOf("function");
    expect(UI.Calendar).toBeTypeOf("function");
  });

  it("tracks Shark's context aliases and parts, in both directions", () => {
    // The rule this guards: a name Shark UI ships is ours, and a name it does not is not. These
    // were deleted once on the argument that renaming somebody else's export is not an API, and
    // restored once the reference was actually read — Shark ships them, under these names, as the
    // same one-line renames. See `decisions/a-name-shark-ships-is-ours.md`.
    //
    // Checkable, which is the point of the rule: every name below is one fetch away from
    // `raw.githubusercontent.com/sharkui-inc/shark-ui/main/registry/react/components/<file>.tsx`.
    // Three of them are the evidence that this is the reference and not a coincidence. Of the 36
    // `export const useX = <ark hook>` lines in `simples/`, 33 just strip `Context` off the Ark
    // name — a rule anybody could rediscover. The other three could not be: `useSheet` is Ark's
    // `useDialogContext`, `useResizable` its `useSplitterContext`, `useRating` its
    // `useRatingGroupContext`.
    expect(UI.useResizable).toBeTypeOf("function");
    expect(UI.useRating).toBeTypeOf("function");
    expect(UI.useSheet).toBeTypeOf("function");
    for (const name of [
      "useAvatar", "useCheckbox", "useDatePicker", "useDialog", "useField", "useHoverCard",
      "useListbox", "useNumberInput", "usePasswordInput", "usePopover", "useSegmentGroup",
      "useSelect", "useSwitch", "useTagsInput", "useTagsInputContext", "useToast", "useToggle",
      "useToggleGroup",
      "useTooltip", "useAccordion", "useClipboard", "useCollapsible", "useEditable",
      "useProgress", "useScrollArea", "useSteps", "useTabs", "useTreeView",
      "ComboboxContext", "SelectContext",
      "CalendarControl", "CalendarLabel", "CalendarTrigger",
      "ColorPickerView", "ColorPickerSwatchPreview",
      "SidebarInput", "FieldSeparator",
    ]) {
      expect(UI[name as keyof typeof UI], name).toBeTypeOf("function");
    }
    // And the other direction, which is the half that makes this a rule rather than a preference.
    // Each of these five was in the same deletion and stays deleted, because Shark's own export
    // list does not carry it: `ListboxContext` (its `listbox.tsx` exports the hook and no
    // component context), `ColorPickerLabel`, and the `ColorPickerFormat*` pair we had added
    // ourselves on the reasoning that Ark ships the parts and Shark exposes neither.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "ListboxContext",
      "ColorPickerLabel", "ColorPickerFormatTrigger", "ColorPickerFormatSelect",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    // `usePinInput` is the one absence parity cannot argue either way: Shark has no `pin-input`
    // component at all — it solves the same problem with `input-otp.tsx`, which exports no hook.
    // So this name was never the reference's, and it goes back to needing a caller of its own.
    expect(surface.usePinInput).toBeUndefined();
    expect(UI.PinInput).toBeTypeOf("function");
    // Ours, not Shark's, and each has a consumer inside the library — the test the aliases above
    // could never pass and no longer have to.
    expect(UI.useSidebar).toBeTypeOf("function");
    expect(UI.useKanzoTheme).toBeTypeOf("function");
    // `useColorPicker` is Shark's *and* has a caller: `color-picker.test.tsx` imports it.
    expect(UI.useColorPicker).toBeTypeOf("function");
    expect(UI.CalendarPresetTrigger).toBeTypeOf("function");
  });

  it("exports every part Shark's registry exports, including the ones our own root renders", () => {
    // These were un-exported in one sweep, on the house principle that a part its own root places
    // needs no export and that exporting one advertises a composition the root does not allow. The
    // principle is a good one and it lost: `CONVENTIONS.md`, *The reference, and what overrules it*
    // — the reference governs the surface, and a house principle overrules neither it nor a
    // measurement. Shark's `registry/react/components/<file>.tsx` exports every name below, so the
    // whole of this list is one fetch away from being falsified by a source outside this repository,
    // which is the property the sweep's argument never had.
    // `decisions/a-house-principle-withholds-no-name.md` carries the composition audit that went
    // with it: for every one of these, Shark's own root renders the part exactly where ours does.
    // The double-render is upstream's shape and we match it — the export was never the defect.
    for (const name of [
      "ProgressTrack", "ProgressRange", "CheckboxIndicator", "ClipboardIndicator",
      "PasswordInputIndicator", "SegmentGroupIndicator", "TreeViewBranchIndicator",
      "CalendarContext", "CalendarTableHead", "CalendarTableRow", "CalendarTableHeader",
      "CalendarTableBody", "CalendarTableCell",
      "ComboboxPositioner", "MenuPositioner", "PopoverPositioner", "SheetPositioner",
      "TourPositioner",
      "ComboboxClear", "ComboboxGroupLabel", "useCombobox", "ListboxItemGroupLabel",
      "PopoverDescription", "PopoverClose", "ScrollAreaScrollbar", "SelectClearTrigger",
      "SheetOverlay", "ToastItem",
      "TourActionTrigger", "TourOverlay", "TourSpotlight", "TourClose", "useTourContext",
    ]) {
      expect(UI[name as keyof typeof UI], name).toBeTypeOf("function");
    }
    // The roots that render them are of course still exported — nothing about placement changed.
    expect(UI.Progress).toBeTypeOf("function");
    expect(UI.Checkbox).toBeTypeOf("function");
    expect(UI.Popover).toBeTypeOf("function");
    // And the other direction, which is what keeps this a rule about the reference rather than a
    // preference for wide surfaces. `SuggestItem` was in the same sweep and stays un-exported:
    // Shark ships no `suggest.tsx` at all, so parity neither grants nor refuses the name, and
    // `decisions/an-export-needs-a-second-call-site.md` decides it like anything else of ours.
    expect((UI as Record<string, unknown>).SuggestItem).toBeUndefined();
  });

  it("adopts the Shark names Ark ships a part for, and declines the ones Shark composed", () => {
    // `decisions/adopt-the-part-the-machine-ships.md` closed the twenty-one names
    // `shark-parity.divergences.ts` had pinned as undecided. Every name below was one of them, and
    // the line between the two lists is one question: does `@ark-ui/react`'s own dist ship the part
    // underneath. `ClipboardValueText` is Shark's `ClipboardValue` under Ark's spelling
    // (`decisions/a-part-is-named-by-its-machine.md`), which is why the parity file declares it as
    // a rename and not as an addition.
    for (const name of [
      "ClipboardValueText",
      "FileUploadClearTrigger", "FileUploadItemPreviewImage", "FileUploadRootProvider",
      "useHighlight", "MenuArrow",
    ]) {
      expect(UI[name as keyof typeof UI], name).toBeTypeOf("function");
    }
    // And the declines, which are the half that makes this a rule rather than an appetite for
    // surface. Four shapes: a bare `ark.div` under a component's name (the file-upload four, and
    // `TourBody`); a component with no Ark machine at all (`Skeleton`); a composition the reference
    // wrote (`FileUploadList`, `PaginationItems`, `PaginationItemLink`); and a part Ark ships that
    // we already export under the machine's own name — `DialogTrigger`, `ComboboxGroupLabel`,
    // `Tour.Control` via `TourActions` — which the record names as the case its line does not
    // reach.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "ClipboardValue",
      "CommandDialogTrigger", "CommandGroupLabel",
      "FileUploadTitle", "FileUploadDescription", "FileUploadHelper", "FileUploadDropzoneIcon",
      "FileUploadList",
      "PaginationItems", "PaginationItemLink",
      "SkeletonCircle", "SkeletonText",
      "TourBody", "TourFooter",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    // The names each decline points at instead. A decline that leaves no way to build the thing is
    // a gap, not a decision.
    expect(UI.DialogTrigger).toBeTypeOf("function");
    expect(UI.ComboboxGroupLabel).toBeTypeOf("function");
    expect(UI.TourActions).toBeTypeOf("function");
    expect(UI.PaginationItem).toBeTypeOf("function");
    expect(UI.PaginationEllipsis).toBeTypeOf("function");
    expect(UI.FileUploadItemGroup).toBeTypeOf("function");
    expect(UI.Skeleton).toBeTypeOf("function");
    expect(UI.DialogBody).toBeTypeOf("function");
    expect(UI.DialogFooter).toBeTypeOf("function");
    // `tags-input` was the one the record did not close, and it is closed: all three of Shark's
    // names are here. `useTagsInputContext` is the only `useXContext` we ship, because it is the
    // only compound where Ark exports both and the plain name therefore had to choose —
    // `useHighlight` is a machine hook too and is not this case: `highlight` has no context hook to
    // alias. `shark-parity.test.ts` holds both bindings so the pair cannot drift back into one.
    expect(surface.TagsInputRootProvider).toBeTypeOf("function");
    expect(surface.useTagsInputContext).toBeTypeOf("function");
  });

  it("exports every compound flat, with no dot-notation namespace", () => {
    // `Preferences` was the one counter-example, via `Object.assign`. Those statics do NOT survive
    // React Server Components: once the module is a client reference `Preferences.Density` reads
    // back as `undefined` and React throws "Element type is invalid". A broken API beside the
    // working one — the flat exports were always the real surface.
    const preferences = UI.Preferences as unknown as Record<string, unknown>;
    expect(preferences.Root).toBeUndefined();
    expect(preferences.Panel).toBeUndefined();
    expect(preferences.Density).toBeUndefined();
    expect(UI.PreferencesRoot).toBeTypeOf("function");
    expect(UI.PreferencesPanel).toBeTypeOf("function");
    expect(UI.PreferencesDensity).toBeTypeOf("function");
    // The one section that is not one section: it draws whatever the packages a host installed
    // contribute. Flat like the rest, because a host composing the panel with `children` replaces
    // the canonical set and would otherwise silently drop every contributed choice.
    expect(UI.PreferencesSections).toBeTypeOf("function");
  });

  it("keeps a recipe off the public surface unless the reference or another module ships it", () => {
    // A variant object exported freezes a class list as API, which is why the default is off. Two
    // things override it, and only two.
    //
    // The reference, for the four Shark's own registry exports. That is the owner's call and it was
    // taken against a stated reservation — a recipe is a different kind of commitment from a
    // component, because what it promises is *our* class list rather than a shape. It is recorded
    // with the condition that would reverse it in
    // `decisions/a-house-principle-withholds-no-name.md`.
    expect(UI.alertVariants).toBeTypeOf("function");
    expect(UI.badgeVariants).toBeTypeOf("function");
    expect(UI.menuContentVariants).toBeTypeOf("function");
    expect(UI.toggleVariants).toBeTypeOf("function");
    // And a *different* module importing one. `statusVariants` is the one to be careful with:
    // `avatar.tsx` imports it as a type for `VariantProps<typeof statusVariants>`, which still
    // requires the value to be exported. A sweep that trusted "used only by its own file" would
    // have broken Avatar.
    expect(UI.buttonVariants).toBeTypeOf("function");
    expect(UI.inputVariants).toBeTypeOf("function");
    expect(UI.statusVariants).toBeTypeOf("function");
    // Everything else stays internal, and the reason is the same rule read the other way: Shark's
    // registry exports no recipe under any of these names. For `Link`, `Section*`, `Shell*`,
    // `Swatch` and `PinInput` it has no file at all; for `float`, `button-group`, `number-input`
    // and `sidebar` it has one that keeps its own recipe local. Silence returns the question to the
    // house rules.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "buttonGroupVariants",
      "floatVariants",
      "linkVariants",
      "numberInputControlVariants",
      "pinInputInputVariants",
      "sectionBodyVariants",
      "sectionHeaderVariants",
      "sectionTitleVariants",
      "shellAsideVariants",
      "swatchVariants",
      "sidebarMenuBadgeVariants",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
  });

  it("keeps CodeMirror-backed components off the root barrel", () => {
    // They import @codemirror/*, an OPTIONAL peer. Re-exporting them here made the root entry
    // statically import CodeMirror, so `import { Button }` threw for anyone without it.
    // They live on @kanzo-tech/ui/editor.
    const surface = UI as Record<string, unknown>;
    expect(surface.CodeEditor).toBeUndefined();
    expect(surface.CompletionField).toBeUndefined();
  });

  it("keeps the Mosaic/vgplot charts off the root barrel", () => {
    // They import @uwdata/vgplot + @uwdata/mosaic-core, OPTIONAL peers that drag in the whole
    // DuckDB/Mosaic analytics stack. Re-exporting them here would make `import { Button }` throw
    // for everyone who has not installed it. They live on @kanzo-tech/ui/analytics.
    const surface = UI as Record<string, unknown>;
    expect(surface.MosaicProvider).toBeUndefined();
    expect(surface.ChartRoot).toBeUndefined();
    expect(surface.ChartBarY).toBeUndefined();
    expect(surface.ChartIntervalX).toBeUndefined();
    expect(surface.useChartContext).toBeUndefined();
  });

  it("keeps the TanStack Table layer off the root barrel", () => {
    // Same contract as the two above: @tanstack/react-table is an OPTIONAL peer, so every part
    // of the data-table layer lives on @kanzo-tech/ui/table.
    const surface = UI as Record<string, unknown>;
    expect(surface.DataTable).toBeUndefined();
    expect(surface.useDataTable).toBeUndefined();
    expect(surface.DataTableRoot).toBeUndefined();
    expect(surface.selectColumn).toBeUndefined();
  });
});
