import { DownloadTrigger as ArkDownloadTrigger } from "@ark-ui/react/download-trigger";

// Renders a `<button>` (compose our Button via `asChild`) that turns `data` into a file download.
export const DownloadTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkDownloadTrigger>
) => <ArkDownloadTrigger {...rest} data-slot={slot ?? "download-trigger"} />;
