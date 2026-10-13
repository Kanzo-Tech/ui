---
"@kanzo-tech/ui": minor
---

Six names leave `@kanzo-tech/ui`, none of them called by a product:

- `KanzoTheme` and `KanzoThemeProps`. A region that wears another theme is `data-theme="<theme>"` and the side's class on an element of yours, as `/docs/themes#theming-a-region` shows; `KanzoThemeProvider` stays the one themer.
- `KanzoThemeName`, which was `string`. Write `string`.
- `safeParseColor`. `ColorPicker` still takes a blank or half-typed `value` without throwing; for a parse of your own, wrap `parseColor` in a `try`.
- `useFindings`. Read the findings you passed to `FindingsRoot` where you passed them.
- From `@kanzo-tech/ui/analytics`, `parseDashboard` and `recommend` (with `Recommendation` and `RecommendIntent`). Read one relation's spec with `parseDashboards({ byRelation: { [relation]: saved } })`; `autoDashboard` is the recommender's door.
