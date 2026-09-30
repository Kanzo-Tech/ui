---
"@kanzo-tech/ui": minor
---

**`LocaleProvider` and `useLocale` are on the root barrel.** Ark's provider sets the `locale` and
`dir` every machine below it formats and orders by — `FormatNumber`, `DatePicker`, `useFilter`, the
number input — so a product that is not in `en-US` no longer needs a direct `@ark-ui/react`
dependency to set it. `useLocale` is Ark's `useLocaleContext`, under the name Shark UI gives it. The
words a component draws remain props with English defaults; the new page `/docs/i18n` lists them.
