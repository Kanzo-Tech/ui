---
"@kanzo-tech/ui": minor
---

**AI-assist reshaped around components, not manual hook wiring.** Inline ghost completion is now a
`complete` prop on `CodeEditor` (the rich CodeMirror surface — "a Textarea, only more complex"),
powered internally by `useAiStream`; candidate suggestions are composition (`useSuggestions` + your
own `Popover`). The two standalone AI components are gone: `CompletionField` folds into
`CodeEditor.complete`; `SuggestMenu` dissolves into the Popover composition (shown in the
metadata-form showcase and docs). The hooks (`useAiStream`/`useCompletion`/`useSuggestions`) stay
public as the engine and the "attach to any input" escape hatch (InputGroup / Editable).

**AppearanceToggle → Shark's idiom.** A compact sun/moon icon button that flips light↔dark on click
(Shift/Alt-click selects System, shown by a monitor badge), replacing the previous menu that also
rendered stretched full-width in the panel.

**SegmentGroup polish.** The selected indicator is now a raised pill (`bg-background` + border +
shadow) on the muted track, with baked-in text contrast — it reads as a crisp segmented control.

**New Shark utilities:** `ClientOnly`, `DownloadTrigger`, `Show`, and `JsonTreeView` (the last now
renders the metadata-form JSON-LD output as an expandable tree instead of a flat `<pre>`).

**New components wired into real showcases** (per the ≥2-call-site rule): `ButtonGroup` (graph
zoom/fit cluster), `Item` (scheduled-runs list), `NumberInput` (bounded count field + scrubber /
formatOptions examples), `Float` (notification-count badge).

**Sidebar** dropdowns match Shark/shadcn anchoring (`gutter: 4`, mobile align). `ColorPicker` and
`Collapsible` were confirmed byte-identical to Shark's registry — no change needed (example polish
only).

**Removed:** `SuggestMenu` (→ composition) and `CompletionField` (→ `CodeEditor.complete`, still on
the `/editor` subpath).
