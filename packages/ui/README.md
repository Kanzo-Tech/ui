# @kanzo-tech/ui

Kanzo's shared UI surface — **Ark UI** behaviour, **tailwind-variants** appearance, design tokens
between them. The component set is adopted from [Shark UI](https://shark.vini.one) and re-branded to
the Kanzo tokens.

```css
@import "tailwindcss";
@import "@kanzo-tech/ui/tailwind.css";
```

```tsx
import { Button, KanzoThemeProvider } from "@kanzo-tech/ui";
```

The package ships Tailwind v4 source, not compiled CSS: your build compiles it with your own
utilities, once.

## What is in it

- **`simples/`** — one component, one job: the adopted primitive set (inputs, overlays, menus,
  navigation, data display) with a flat compound API — `DialogTrigger` and `DialogContent`, not
  `Dialog.Trigger`.
- **`composites/`** — assemblies of those that stay domain-free: the sidebar, the code editor, the
  `Preferences` theme panel.
- **`layouts/`** — the Shell and Section regions. Structure only, no appearance.

Everything is exported flat from the root, so a component moving between layers is never a breaking
change. The docs site lists the surface with a live example per component, and its Philosophy page
says how the three layers divide and what has to be true before a component is added.

## Subpaths

The root barrel never statically imports an optional peer, because that would break
`import { Button }` for everyone who did not install it. Anything that needs one lives on its own
entry:

| Entry | Peer |
|---|---|
| `@kanzo-tech/ui` | none beyond React and `lucide-react` |
| `@kanzo-tech/ui/editor` | `@codemirror/*` |
| `@kanzo-tech/ui/table` | `@tanstack/react-table` |
| `@kanzo-tech/ui/analytics` | `@uwdata/vgplot`, `@uwdata/mosaic-*` |

`/analytics` holds two layers over one Mosaic coordinator and one crossfilter: the charts grammar
(`MosaicProvider`, `ChartRoot`, marks, interactors, inputs, `ChartStat`) and the mini BI kit built
from it — `Dashboard` with `DashboardFilters`, `DashboardStat`, `ChartCard`, `DetailTable` and
`FilterChips`, drawn from a relation's `useFieldStats` and a JSON `DashboardSpec` the host saves.

```tsx
import { Dashboard, MosaicProvider, engine } from "@kanzo-tech/ui/analytics";

const { coordinator } = await engine();
<MosaicProvider coordinator={coordinator}>
  <Dashboard table="sightings" value={saved} onChange={save} />
</MosaicProvider>;
```

The docs site's Analytics section has the mental model, the spec field by field, a host recipe
(debounced saves, read-only, custom labels and colours) and the pitfalls.

## Theming

`KanzoThemeProvider` writes the theme axes as `data-*` attributes on `<html>` — required, because
Ark's overlays portal to `document.body`. `useKanzoTheme()` drives them, `themeScript()` prevents an
SSR flash. Tokens and axes come from `@kanzo-tech/theme`.

### Preference menus

`PreferencesSections` draws every preference a host offers: the theme picker (the side, and a theme
for each side), density, and whatever the packages a host installed contribute — or one namespace
of them (`namespace="theme"` is the core's). It is the one way to mount a preference control: radius
and the faces are the theme's, so there is no control for them. `PreferencesField` /
`PreferencesFieldSet` title a section of your own the same way. None of them knows what it is mounted
on — the theme cards lay out on a container query, never a window width.

`Preferences` (and its `PreferencesRoot` / `Trigger` / `Panel` parts) is one **surface** over that
kit: a non-modal drawer with a hotkey. A product with a real settings area drops the same sections
into its own page instead, beside its own menu — no drawer, nothing to opt out of, no component to
import for it. **Both are first-class**, and a section that ever needed to know which one it was on
would be the design failing. The docs site shows the two side by side: `showcases/metadata-form` for
the drawer, `showcases/settings` for the page.

Admission rule: nothing domain-specific — no RDF, SHACL, fossil, graph or auth knowledge.
