// Ark's formatters, as they are. Each renders a bare string — no element, so nothing to slot and
// nothing to style — through `Intl`, in the locale of the nearest `LocaleProvider` (`en-US` without
// one). `FormatByte` is what a file size is; `FormatNumber` takes `Intl.NumberFormatOptions` and
// `FormatRelativeTime` takes `Intl.RelativeTimeFormatOptions`.
export {
  FormatByte,
  FormatNumber,
  FormatRelativeTime,
  type FormatByteProps,
  type FormatNumberProps,
  type FormatRelativeTimeProps,
} from "@ark-ui/react/format";
