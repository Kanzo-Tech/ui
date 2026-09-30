import {
  LocaleProvider as ArkLocaleProvider,
  useLocaleContext,
} from "@ark-ui/react/locale";

// Transparent, like `ClientOnly`: Ark's provider renders `children` and no element, so there is no
// DOM node to slot. What it sets is the `locale` and `dir` every Ark machine below it formats and
// mirrors by — `Format`, `DatePicker`, `useFilter`, the number and date inputs — which is why a
// product that is not in `en-US` puts one at its root. It translates nothing: the words a
// component draws are props on the component, written by the host.
export const LocaleProvider = (
  props: React.ComponentProps<typeof ArkLocaleProvider>
) => <ArkLocaleProvider {...props} />;

// Shark's name for Ark's `useLocaleContext`, by the same rule as every other context alias here.
export const useLocale = useLocaleContext;
