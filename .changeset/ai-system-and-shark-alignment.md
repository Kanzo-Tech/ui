---
"@kanzo-tech/ui": minor
"@kanzo-tech/theme": minor
---

**Generic AI-assist system.** The streaming plumbing that `SuggestMenu` and `CompletionField` each
hand-rolled is now three headless hooks in `simples/use-ai.ts` — `useAiStream` (the engine),
`useCompletion` (ghost/accept/dismiss; it does not own your input value), `useSuggestions`
(dedup + refill + retry-once) — plus the exported `cleanGhost`. The two components are now thin
conveniences over the hooks (unchanged public API), and any input can be made AI-assisted by
attaching a hook — documented with `InputGroup`-around-`Textarea` and `Editable` examples. The
hooks pull in no CodeMirror, so they live in the root barrel; `CompletionField` stays on `/editor`.

**Shark primitives adopted.** `ButtonGroup` (action clusters; `role="group"` + required
`aria-label`), `NumberInput` (Ark stepper machine; distinct from the `NumberField` text facade),
`Item` (the row counterpart to `Card`: `ItemGroup`/`Item`/`ItemMedia`/`ItemContent`/…), and
`Float` (9-placement corner anchor). `Ribbon` is now a thin wrapper over `Float` (unchanged API).

**Appearance gains a System mode.** `Appearance` widens to `"light" | "dark" | "system"` (the
preference) with a new `ResolvedAppearance = "light" | "dark"` (the applied value). `KanzoThemeProvider`
resolves `system` via `matchMedia` in both the host-controller and built-in-fallback paths, and the
SSR `themeScript` matches it (anti-FOUC). New `AppearanceToggle` composite (icon button + Light/Dark/
System menu). `SegmentGroup` gains a data-driven `options` convenience.

**Sidebar polish.** `InstanceSwitcher` and `SidebarUser` gain an open-state trigger tint, a labelled
menu group, and a collapsed-rail accessible name (`aria-label`).

**Removals** (superseded, no library consumers): `MetricCard` → compose from `Card` + `Skeleton`
(shown as a showcase). `SecretField` → folded into `password-input` (opt-in `hasStoredValue` /
`storedPlaceholder` props; an API key is a password).
