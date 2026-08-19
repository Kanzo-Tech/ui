/**
 * Every way this library's export surface differs from Shark UI's, with the reason for each.
 *
 * `shark-parity.test.ts` computes the difference against the checked-in snapshot of Shark's
 * registry and requires that every entry it finds is declared here — and that every entry declared
 * here is still a real difference. Both halves matter. The first is what would have caught 31
 * context aliases being deleted on a house rule while Shark shipped 38 of the 43 names involved
 * (`decisions/a-name-shark-ships-is-ours.md`); the second is what stops this file rotting into an
 * allowlist that only ever grows.
 *
 * **A reason is not a note.** `CONVENTIONS.md`, *The reference, and what overrules it*: the
 * reference governs the surface, a measurement overrules the reference, and a house principle
 * overrules neither. So a reason here is one of four things, and saying which is the point:
 *
 * 1. a measurement — a number, what it was measured against, a threshold it crosses;
 * 2. a decision record, cited by path, which carries its own evidence and its own reversal;
 * 3. an assertion in another guard, cited by file and test name;
 * 4. `Undecided — …`, where nothing above applies. That is a legitimate state
 *    (`decisions/a-measurement-overrules-the-reference.md`: *where none of that decides, the owner
 *    does, and the case is recorded as undecided rather than argued into one of the branches*),
 *    and the test pins the exact list, so one cannot be added or quietly resolved without an edit
 *    somebody reviews.
 *
 * Anything cited by path is checked to exist. A reason pointing at a file somebody deleted is not
 * a reason.
 */

/** Shark's registry filename → our module, relative to `src/`, where the two do not match. */
export const MODULE_MAP: Readonly<Record<string, string>> = {
  // Ours is a composite (it owns provider state and the mobile sheet), so it sits with the
  // composites; its 24 exported names match Shark's list exactly, in both directions.
  sidebar: "composites/sidebar.tsx",
};

/**
 * A Shark component we do not ship, keyed by its registry filename.
 *
 * Most of these are the ordinary shape of adopting a reference incrementally rather than a
 * disagreement with it: `decisions/adoption-before-design.md` and
 * `decisions/an-export-needs-a-second-call-site.md` between them say a family nobody renders does
 * not get built. Where we solve the same problem differently, the entry names what we solve it
 * with, because that is the thing a reader is looking for.
 */
export const UNADOPTED: Readonly<Record<string, string>> = {
  announcement: "Not built. A pill with a title and a variant; `Badge` is what the library composes for this today.",
  "aspect-ratio": "Not built. Tailwind's `aspect-*` utility is the whole of it — a wrapper would add a name, not a capability.",
  autocomplete: "Not built. Shark's own file wraps Ark's combobox machine; ours is `Combobox`, and the difference is a prop on the same machine (`decisions/a-machine-with-a-switch-is-a-variant.md`).",
  "bottom-navigation": "Not built. Mobile chrome for a shell that is sidebar-first — `decisions/a-shell-has-two-legal-shapes.md` names the two shapes, and this is not one of them.",
  carousel: "Not built. No renderer in the library or the docs.",
  chart:
    "Not adopted, and not comparable: Shark's chart wraps Recharts, ours is `@kanzo-tech/ui/analytics` over Mosaic and vgplot — a different engine with a different vocabulary (`decisions/a-grammar-ships-its-whole-vocabulary.md`). The optional-peer subpaths are outside this guard's corpus in any case; see the blind spots in `shark-parity.test.ts`.",
  "circular-progress": "Not built. No renderer in the library or the docs.",
  "circular-slider": "Not built. No renderer in the library or the docs.",
  "context-menu":
    "Deleted deliberately. A context menu is `Menu` with a different trigger, which is what `MenuContextTrigger` is — nine of the ten exports were `data-slot` renames of `Menu`'s parts. `decisions/a-machine-with-a-switch-is-a-variant.md`; tombstoned in `index.test.ts`, `drops components superseded by composition or a merge`.",
  "date-input": "Not built. `DatePicker` over Ark's date-picker machine is the date surface here, and `parseDate` is re-exported from the barrel so its value can be built.",
  drawer: "Not built. `Sheet` is the side-anchored dialog in this library; Shark ships both over the same Ark dialog machine.",
  "floating-panel":
    "Name collision, not adoption. Shark's wraps Ark's floating-panel machine (fifteen parts, drag, stage, minimise/maximise). Ours is a plain resizable surface over a `<div>` with two exports, for floating over a canvas or a graph. Same name, different component — the entry in OURS_ALONE is the other half of this one.",
  format: "Not built. `FormatByte` / `FormatNumber` / `FormatRelativeTime` are Ark's format parts; nothing here renders one yet.",
  frame: "Not built. `SectionRoot` and its parts are the framed-region composite in this library.",
  hint: "Not built. `Tooltip` is the hover surface here.",
  "image-cropper": "Not built. No renderer in the library or the docs.",
  "input-otp":
    "Not adopted under this name. We ship `PinInput` over Ark's pin-input machine; Shark solves the same problem with `input-otp` and exports no hook for it, which is exactly why `usePinInput` is ours to decide rather than the reference's — `decisions/a-name-shark-ships-is-ours.md`.",
  "link-overlay": "Not built. No renderer in the library or the docs.",
  locale: "Not built as a component. `useFilter` from `@ark-ui/react/locale` is re-exported from the barrel because `Combobox` cannot be used without it; Ark's `LocaleProvider` has no such forcing consumer.",
  marquee: "Not built. No renderer in the library or the docs.",
  presence: "Not built. Ark's presence primitive is used inside the components that need it, never composed by a caller here.",
  "qr-code": "Not built. No renderer in the library or the docs.",
  "signature-pad": "Not built. No renderer in the library or the docs.",
  swap: "Not built. No renderer in the library or the docs.",
  timer: "Not built. No renderer in the library or the docs.",
  "toggle-tooltip": "Not built. `Tooltip` plus `Toggle` compose it; nothing here needed the pre-arrangement.",
};

/**
 * A module of ours Shark has no file for, keyed by our filename in `simples/` (or the key it takes
 * in `MODULE_MAP`). These are additions to the reference, and each answers to the house rules
 * instead — admission, and a second call site.
 */
export const OURS_ALONE: Readonly<Record<string, string>> = {
  FacetFilter: "Ours. The one facet-filter surface, built on `Listbox` because a filter is a value — `decisions/a-filter-is-a-value.md`. On the root barrel because its two consumers sit on subpaths that must not import each other.",
  FieldArray: "Ours. Repeatable field rows. No Ark machine and no Shark file; `index.test.ts` pins it.",
  Link: "Ours. The styled anchor, and the routing seam every composite reaches through `asChild` — `index.test.ts`, `drops the components that took a layout tree as an array prop`.",
  complete: "Ours. Inline AI completion composed over a pure `Input` / `Textarea` — `decisions/ai-assist-composes-over-pure-inputs.md`.",
  "floating-panel": "Ours, and it collides with a Shark name. See the UNADOPTED entry, which is the other half of this one.",
  "pin-input": "Ours over Ark's pin-input machine. Shark's answer to the same problem is `input-otp`, under names that do not correspond.",
  "stat-tile": "Ours. A composite by the test in `decisions/a-machine-with-a-switch-is-a-variant.md`, which names this component as the worked example.",
  suggest: "Ours. The suggestion compound half of the AI surface — `decisions/ai-assist-composes-over-pure-inputs.md`.",
  swatch: "Ours. A strip that only depicts; Ark's picker swatch parts all require a picker context and compute `checked` against its single value, so a sixteen-slot palette strip cannot be built from them (`index.test.ts`, `exposes the core surface`).",
  types: "Type-only module. It contributes no name to the value surface, so parity has nothing to compare.",
  "use-ai": "Ours. The two headless engine hooks, exposed for surfaces we did not write — `index.test.ts`, `keeps the AI engine hooks exported, and the CodeMirror style not`.",
};

/**
 * The same Ark part under a different exported name. Declaring these as a pair rather than as one
 * absence plus one addition is the honest shape: nothing is missing and nothing is extra, the two
 * references simply disagree about spelling, and `CONVENTIONS.md` picks Ark's part name.
 *
 * Keyed `"<shark file>:<Shark's name>"`.
 */
export const RENAMED: Readonly<Record<string, { readonly ours: string; readonly reason: string }>> = {
  "clipboard:ClipboardValue": { ours: "ClipboardValueText", reason: ARK_PART_NAME("ValueText") },
  "accordion:AccordionTrigger": { ours: "AccordionItemTrigger", reason: ARK_PART_NAME("ItemTrigger") },
  "accordion:AccordionContent": { ours: "AccordionItemContent", reason: ARK_PART_NAME("ItemContent") },
  "number-input:NumberInputGroup": { ours: "NumberInputControl", reason: ARK_PART_NAME("Control") },
  "number-input:NumberInputIncrement": { ours: "NumberInputIncrementTrigger", reason: ARK_PART_NAME("IncrementTrigger") },
  "number-input:NumberInputDecrement": { ours: "NumberInputDecrementTrigger", reason: ARK_PART_NAME("DecrementTrigger") },
  "pagination:PaginationPrevious": { ours: "PaginationPrevTrigger", reason: ARK_PART_NAME("PrevTrigger") },
  "pagination:PaginationNext": { ours: "PaginationNextTrigger", reason: ARK_PART_NAME("NextTrigger") },
  "file-upload:FileUploadItemSize": { ours: "FileUploadItemSizeText", reason: ARK_PART_NAME("ItemSizeText") },
};

/** The one rule behind all nine renames, spelled once so it cannot drift into nine variants. */
function ARK_PART_NAME(part: string): string {
  return (
    `Both wrap Ark's \`${part}\`. \`CONVENTIONS.md\`, *Naming*: a part is base plus part, so the ` +
    `Ark spelling is the one that survives — Shark shortens it instead. Settled 2026-07-31 in ` +
    `\`decisions/a-part-is-named-by-its-machine.md\`: a part name is a fact about the machine, so ` +
    `it belongs to the reference that owns the machine. That record settles these nine and ` +
    `deliberately not the general case of the two references disagreeing.`
  );
}

const DIALOG_OWNS_THE_TITLE =
  "`DialogTitle` / `DialogDescription` are the parts, and both components say so in their own " +
  "source: `AlertDialog` is `Dialog` with a role and `Sheet` is `Dialog` with a side, one machine " +
  "each (`decisions/a-machine-with-a-switch-is-a-variant.md`). Shark ships the renamed pair anyway. " +
  "The name is missing; the capability is not.";

/**
 * The line `decisions/adopt-the-part-the-machine-ships.md` draws, spelled once.
 *
 * It has two named weaknesses, both in the record: a part's provenance says nothing about whether
 * we need it, and the rule is silent on the case that turned out to be the commonest here — Ark
 * ships the part, and we already export it under the machine's own name. Those declines say so.
 */
const ARK_SHIPS_NO_SUCH_PART = (composed: string): string =>
  `Declined. Ark's machine ships no such part: ${composed}. ` +
  `\`decisions/adopt-the-part-the-machine-ships.md\` adopts the names whose part Ark already ` +
  `ships and declines the ones the reference composed itself.`;

const ALREADY_OURS_UNDER_ARKS_NAME = (part: string): string =>
  `Declined. Ark ships the part and we already export it, as \`${part}\` — so this is a second ` +
  `spelling rather than a missing capability, which is the case ` +
  `\`decisions/adopt-the-part-the-machine-ships.md\` does not reach and says so. The same shape ` +
  `as the four dialog titles above.`;

const DECLINED_FILE_UPLOAD = ARK_SHIPS_NO_SUCH_PART(
  "the file-upload anatomy is root, label, dropzone, trigger, clear trigger, hidden input, item " +
    "group and the item's own parts, and each of these four is a bare `ark.div` in Shark's file",
);

const DECLINED_PAGINATION =
  "Declined. `PaginationItems` maps Ark's `Context` render prop over the page range and " +
  "`PaginationItemLink` hand-writes an `<a href=\"?page=N\">` — a routing convention, not a part: " +
  "`Link` is the routing seam here and it goes through `asChild`. Ark's parts are `Item`, " +
  "`Ellipsis` and `Context`, and all three are on the barrel, so the loop is four lines a caller " +
  "writes against exports they already have. `decisions/adopt-the-part-the-machine-ships.md`.";

const DECLINED_SKELETON =
  "Declined. `Skeleton` has no Ark machine at all — it is an `ark.div` with a pulse — so there is " +
  "no part to adopt, and `decisions/adopt-the-part-the-machine-ships.md` decides it on that. " +
  "`simples/skeleton.tsx` carries the older half of the argument: a circle is `size-10 shrink-0 " +
  "rounded-full` on the one export, and `SkeletonText` forced every line to a height its only " +
  "caller did not want. `packages/ui/src/documented-exports.test.ts` holds " +
  "`docs/content/docs/overlays/loading.mdx` to saying so, in its DELIBERATE list.";

const DECLINED_TOUR_BODY = ARK_SHIPS_NO_SUCH_PART(
  "the tour anatomy is title, description, actions, control, progress text, spotlight, backdrop " +
    "and the triggers, and Shark's `TourBody` is `DialogBody` under a tour slot, which is what " +
    "`simples/tour.tsx` says in place of it",
);

/**
 * A name Shark exports that we do not, keyed `"<shark file>:<Name>"`.
 *
 * This map used to be dominated by the parts sweep — thirty-four names withheld because our own
 * root renders the part, plus four recipes withheld because a class list is not API. Both were
 * house principles, and `decisions/a-house-principle-withholds-no-name.md` restored all thirty-eight
 * against `decisions/a-measurement-overrules-the-reference.md`. What is left is the shape a
 * withheld name is supposed to have: a decision with its own record, or an open question with
 * nobody's name on it yet.
 */
export const WITHHELD: Readonly<Record<string, string>> = {
  // ── One dialog machine owns the title and the description ────────────────────────────────────
  "alert-dialog:AlertDialogTitle": DIALOG_OWNS_THE_TITLE,
  "alert-dialog:AlertDialogDescription": DIALOG_OWNS_THE_TITLE,
  "sheet:SheetTitle": DIALOG_OWNS_THE_TITLE,
  "sheet:SheetDescription": DIALOG_OWNS_THE_TITLE,

  // ── Declined on Ark provenance ───────────────────────────────────────────────────────────────
  // `decisions/adopt-the-part-the-machine-ships.md` settled the twenty-one names this map held as
  // undecided. Seven were adopted and are gone from here; twelve are below; two are still open.
  "command:CommandDialogTrigger": ALREADY_OURS_UNDER_ARKS_NAME("DialogTrigger"),
  "command:CommandGroupLabel": ALREADY_OURS_UNDER_ARKS_NAME("ComboboxGroupLabel"),
  "file-upload:FileUploadDescription": DECLINED_FILE_UPLOAD,
  "file-upload:FileUploadDropzoneIcon": DECLINED_FILE_UPLOAD,
  "file-upload:FileUploadHelper": DECLINED_FILE_UPLOAD,
  "file-upload:FileUploadTitle": DECLINED_FILE_UPLOAD,
  "file-upload:FileUploadList":
    "Declined. Not a part in either machine: Shark's `FileUploadList` reads `acceptedFiles` off " +
    "the context and renders the whole item — preview, name, size, delete button, icon — as a " +
    "fixed arrangement a caller cannot reorder or wrap. `decisions/a-layout-tree-is-children.md` " +
    "is the rule it fails, and `decisions/adopt-the-part-the-machine-ships.md` the one that " +
    "declines it: Ark ships `ItemGroup` and `Item`, which is the composition without the loop.",
  "pagination:PaginationItemLink": DECLINED_PAGINATION,
  "pagination:PaginationItems": DECLINED_PAGINATION,
  "skeleton:SkeletonCircle": DECLINED_SKELETON,
  "skeleton:SkeletonText": DECLINED_SKELETON,
  "tour:TourBody": DECLINED_TOUR_BODY,
  "tour:TourFooter":
    "Declined. Ark ships `Tour.Control` and `TourActions` already renders it, so this is the " +
    "second wrapper over one part rather than a missing one — the " +
    "`ALREADY_OURS_UNDER_ARKS_NAME` case, in the shape the rule does not reach. Ark's `Control` " +
    "is a bare `ark.div` with static anatomy attributes and no machine wiring, so a caller laying " +
    "footer content out by hand wants `DialogFooter`. " +
    "`decisions/adopt-the-part-the-machine-ships.md`.",

};

/**
 * A name we export that Shark's matching component does not, keyed `"<shark file>:<Name>"`.
 *
 * `decisions/a-name-shark-ships-is-ours.md` reads, as written, in both directions: *a `useX` or a
 * part Shark's registry exports, we export under that name; one it does not export, we do not.*
 * Thirteen of the entries below are Ark parts Shark's file does not export, so under the widest
 * reading of that sentence they should not exist. They do exist for one reason, and it is a real
 * one: **our root is thin where Shark's pre-arranges.** `Rating` is the clean example — Shark's
 * root lays out label, control and hidden input itself and exports two names; ours exports the
 * anatomy and lets the caller compose it. Withdrawing the parts would not match Shark, it would
 * leave a component that cannot be labelled. See BEYOND_THE_SURFACE.
 */
export const ADDED: Readonly<Record<string, string>> = {
  "clipboard:ClipboardControl": THIN_ROOT("Clipboard"),
  "clipboard:ClipboardLabel": THIN_ROOT("Clipboard"),
  "color-picker:safeParseColor":
    "Ours. A colour parse that returns `undefined` instead of throwing on the half-typed input a text field produces. `simples/color-picker.tsx` is also the one file `no-literal-hues.test.ts` allows literals in, because colour is its subject matter.",
  "field:FieldSetError":
    "The fieldset-*scoped* message parts, which are a different Ark machine from `FieldError` / `FieldHelper` and were the only thing `field.tsx` lacked when `Fieldset` and `FieldSet` were merged — `index.test.ts`, `drops components superseded by composition or a merge`.",
  "field:FieldSetHelper":
    "The other half of `FieldSetError`; same merge, same record.",
  "file-upload:FileUploadHiddenInput": THIN_ROOT("FileUpload"),
  "file-upload:FileUploadLabel": THIN_ROOT("FileUpload"),
  "listbox:ListboxInput":
    "The field `FacetFilter`'s `searchable` draws. An Ark part Shark's listbox omits, so nothing upstream would notice it going missing — `index.test.ts`, `exposes the one facet-filter surface, on the root barrel`.",
  "listbox:ListboxLabel": THIN_ROOT("Listbox"),
  "menu:MenuContextTrigger":
    "The whole of what `context-menu.tsx` was, once its nine `data-slot` renames of `Menu`'s parts were removed — `decisions/a-machine-with-a-switch-is-a-variant.md`. Shark keeps the separate file; this name is what replaces it.",
  "number-input:NumberInputLabel": THIN_ROOT("NumberInput"),
  "number-input:NumberInputValueText": THIN_ROOT("NumberInput"),
  "radio-group:RadioGroupCard":
    "What `CardRadioGroup` collapsed into: the same item styled off `data-[state=checked]`, with the grid moved onto `RadioGroup` as a `columns` prop — `index.test.ts`, `drops components superseded by composition or a merge`.",
  "radio-group:RadioGroupIndicator": THIN_ROOT("RadioGroup"),
  "rating:RatingContext": THIN_ROOT("Rating"),
  "rating:RatingControl": THIN_ROOT("Rating"),
  "rating:RatingHiddenInput": THIN_ROOT("Rating"),
  "rating:RatingLabel": THIN_ROOT("Rating"),
  "tags-input:TagsInputHiddenInput": THIN_ROOT("TagsInput"),
  "tags-input:TagsInputLabel": THIN_ROOT("TagsInput"),
};

/** The one rule behind the thirteen Ark-part additions, spelled once. */
function THIN_ROOT(component: string): string {
  return (
    `An Ark part our \`${component}\` root does not render, so a caller composes it and must be able ` +
    `to import it. Shark's root pre-arranges the same part internally and exports nothing for it — ` +
    `the divergence is where the layout lives, not which parts exist. This is the direction ` +
    `\`decisions/a-name-shark-ships-is-ours.md\` reads on least comfortably; BEYOND_THE_SURFACE ` +
    `records that.`
  );
}

/**
 * Divergences this guard cannot express as a name, recorded here because they are the ones a
 * reader arrives looking for — and because each is checkable somewhere, which is what a divergence
 * has to be. `held` is a list of paths relative to the repository root; the test asserts every one
 * of them exists, so a citation cannot outlive the file it points at.
 */
export const BEYOND_THE_SURFACE: readonly {
  readonly what: string;
  readonly why: string;
  readonly held: readonly string[];
}[] = [
  {
    what: "The focus ring is solid where Shark dilutes it.",
    why:
      "The only divergence in this library with a number behind it. Shark's diluted ring measured " +
      "1.29:1 in light against the 3:1 WCAG 1.4.11 asks of the visual information identifying a " +
      "control's state — a live failure on the element that clause names first. The measurement " +
      "licenses exactly this and no neighbouring recipe.",
    held: [
      "packages/ui/src/alpha-steps.test.ts",
      "decisions/a-measurement-overrules-the-reference.md",
    ],
  },
  {
    what: "Logical properties throughout, where Shark writes physical ones.",
    why:
      "One code path mirrors correctly under RTL. This is a house rule and not a measurement, so " +
      "by the written order it does not overrule the reference — but it is not a surface " +
      "divergence either: no exported name changes, and the reference's own file is the allowlist " +
      "entry for the one table that keeps the physical pair (Shark pairs it with an explicit `rtl:` " +
      "override, and so do we).",
    held: ["packages/ui/src/logical-properties.test.ts"],
  },
  {
    what: "`slot` is a prop; Shark writes `data-slot` literals into wrapped components.",
    why:
      "This one IS surface — it is a prop on every part — and this guard cannot see it, because it " +
      "compares exported names and not their signatures. Our recipes select on `data-slot`, so a " +
      "caller who passes one to a Shark-shaped part silently deletes styling the component depends " +
      "on, with no error and nothing to grep for. Renaming a part is a real need, so it is served " +
      "by a declared `slot?: string` written after the spread.",
    held: [
      "decisions/a-primitive-owns-its-slot.md",
      "packages/ui/src/data-slot.test.tsx",
    ],
  },
  {
    what:
      "`useCombobox` and `useTourContext` match Shark exactly and collide with Ark's exports of " +
      "the same names.",
    why:
      "Both were withheld under the parts sweep and both came back with it " +
      "(`decisions/a-house-principle-withholds-no-name.md`). Neither is a divergence from Shark — " +
      "it binds each one the way we do, and its files export no second hook beside them, so this " +
      "guard reports parity and is right to. The cost is one nobody had counted: `@ark-ui/react` " +
      "exports `useCombobox`, the machine hook that takes props, *and* `useComboboxContext`, and " +
      "ours is the second under the first's name — so a consumer with both packages in scope has " +
      "two `useCombobox` with incompatible signatures and no error to read. `useTourContext` is " +
      "the same shape with a sharper edge, because the name ends in `Context` and returns " +
      "something that is not Ark's tour context at all: `tour.tsx`'s own `{ tour, handleStart }`, " +
      "whose type is not exported either. This was invisible while the names were withheld, which " +
      "is the honest reason it is being written down now rather than then.",
    held: [
      "decisions/a-house-principle-withholds-no-name.md",
      "packages/ui/src/shark-parity.test.ts",
      "packages/ui/src/simples/tour.tsx",
    ],
  },
  {
    what: "`useTagsInputContext` is the only `useXContext` on the surface.",
    why:
      "Every other compound names one hook, `useX`, and it is Ark's context hook — thirty-six of " +
      "them, and Shark writes the identical line in fifty of its ninety-five files. `tags-input` " +
      "names two because `TagsInputRootProvider` has to be handed a machine, so the plain name goes " +
      "to the machine hook and the context one takes the suffix. That is Shark's own shape for this " +
      "file, adopted whole rather than half: the alternative left `useTagsInput` matching by name " +
      "and not by binding, which a name-level comparison reports as parity. `shark-parity.test.ts` " +
      "asserts both bindings against Ark, and that no second `useXContext` has appeared beside them.",
    held: [
      "decisions/a-house-principle-withholds-no-name.md",
      "decisions/adopt-the-part-the-machine-ships.md",
      "packages/ui/src/simples/tags-input.tsx",
    ],
  },
  {
    what:
      "Four recipe names match Shark's and the class lists behind them do not, and those class " +
      "lists are now public.",
    why:
      "`alertVariants`, `badgeVariants`, `menuContentVariants` and `toggleVariants` were withheld " +
      "on the house rule that an exported `tv()` freezes a class list as API, and " +
      "`decisions/a-house-principle-withholds-no-name.md` restored them for parity. The " +
      "reservation the owner stated while choosing parity anyway is the divergence this guard " +
      "cannot see: it compares names and never class strings, and every one of these four differs " +
      "from Shark's in the utilities it holds — `toggleVariants` composes our `buttonVariants` and " +
      "paints the pressed state as a wash, `menuContentVariants` pins a fixed max-height Shark " +
      "does not. So the four names agree with the reference and what a consumer can now depend on " +
      "does not. The reversal condition is in the record: a consumer reaching into one of these in " +
      "a way that blocks a restyle.",
    held: [
      "decisions/a-house-principle-withholds-no-name.md",
      "packages/ui/src/index.test.ts",
      "packages/ui/src/simples/toggle.tsx",
    ],
  },
  {
    what: "Thirteen Ark parts we export that Shark's matching file does not.",
    why:
      "The mirror image of the sweep, and the reading of " +
      "`decisions/a-name-shark-ships-is-ours.md` that its own text does not settle: the decision " +
      "governs *context aliases and re-exported Ark parts*, and taken at that width it forbids " +
      "these. The reason they exist is structural rather than preferential — our roots are thin " +
      "where Shark's pre-arrange — but that argument is nowhere in the record, which is why it is " +
      "written here.",
    held: ["decisions/a-name-shark-ships-is-ours.md"],
  },
  {
    what: "Nine parts spelled with Ark's name where Shark shortens it.",
    why:
      "The two references disagreeing, which `CONVENTIONS.md` assigns to the owner rather than to " +
      "either rule — and the owner took it, narrowly, in " +
      "`decisions/a-part-is-named-by-its-machine.md`: a part name is a fact about the machine. " +
      "This entry used to read that the eight had never been weighed against parity, which stopped " +
      "being true the day that record landed and is corrected here. `ClipboardValueText` is the " +
      "ninth, adopted under the same rule. Nothing is missing either way — RENAMED carries both " +
      "halves — and what stays open is the general case of the two references colliding, which " +
      "that record deliberately does not settle.",
    held: [
      "CONVENTIONS.md",
      "decisions/a-part-is-named-by-its-machine.md",
      "decisions/a-name-shark-ships-is-ours.md",
    ],
  },
];
