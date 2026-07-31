---
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

**`"system"` is not a value any more. Following the OS is the absence of one.**

`Appearance` is `"light" | "dark"` — a side of the compiled document, and there are exactly two
because `compile()` emits exactly two blocks. The preference is the new `AppearancePref =
Appearance | null`, where `null` means the OS decides, and `DEFAULT_PREFS.appearance` is `null`.
Nothing about the behaviour changed: a first visit on a dark OS still paints dark, the live
`matchMedia` listener still re-resolves while nothing is pinned, and Reset still hands the side back.
Only the spelling changed, and one type disappeared.

**Which layer you are decides this, and the references split on exactly that line.** The
theme-switching libraries make it a value: next-themes ships `defaultTheme = "system"` and appends
`"system"` to its `themes` array, MUI has `mode: "light" | "dark" | "system"`, Mantine calls it
`"auto"`. The token layers do not: daisyUI writes `themes: light --default, dark --prefersdark`,
where the OS preference is a flag on a theme and `data-theme` overrides it; Tailwind has a media
query or a class; Radix Themes declines to model it and hands the job to next-themes. CSS itself has
no third keyword — `color-scheme: light dark` means "the OS decides" and an explicit side overrides.

We are a token layer. And `themeScript` had never believed in the third value: its resolution has
always been `(ap==='light'||ap==='dark')?ap:matchMedia(…)`, with a comment saying *anything that is
not an explicit side means "ask the OS"*. The word only ever existed in the React half.

### `ResolvedAppearance` is deleted, because it had become `Appearance`

The two types differed only in `"system"`. What distinguishes a preference from a resolution is now
nullability, so `resolvedAppearance` is typed `Appearance` and `IdentityOption.swatches` is
`Record<Appearance, string[]>`. `AppearancePref` is the new export; `ResolvedAppearance` is gone with
no alias.

### One whitelist, over both sources — and it closes a real divergence

`explicit(v)` accepts `"light"` and `"dark"` and answers `null` to everything else, and it runs over
*both* the host controller's `theme` and the stored blob. A host's `"system"` therefore translates in
one place and no other line in either package knows that `"system"` is a word.

It also fixes a defect: the script whitelisted what it read and the provider did not, so a blob
holding `{"appearance":"purple"}` — or `"system"`, which any next-themes user's storage may hold —
produced a bogus preference on the React side and a correct one before hydration. The two sides now
apply the identical test, which is what `theme-script.test.ts` diffs.

### `APPEARANCE_KEY` and its migration are deleted

The standalone `kanzo_appearance` key, `legacyAppearance()`, the `themeScript({ appearanceKey })`
option and the four tests that pinned the fallback are gone. It was a migration path for users of an
unpublished package, and it was the only reason a stored `null` had to be distinguished from an
absent field — so removing it removed a subtlety from both sides rather than just some code.

### Breaking

- `Appearance` no longer includes `"system"`; `ThemePrefs.appearance` is `AppearancePref`.
- `ResolvedAppearance` and `APPEARANCE_KEY` are deleted; `ThemeScriptOptions.appearanceKey` is gone.
- `setAppearance` takes `AppearancePref`; pass `null` to hand the side back to the OS.
- `data-appearance` on `AppearanceToggle` is **absent** while nothing is pinned, where it used to
  read `"system"` — the same rule the axis table applies to every default.
