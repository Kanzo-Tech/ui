import { DownloadTrigger as ArkDownloadTrigger } from "@ark-ui/react/download-trigger";

// Renders a `<button>` (compose our Button via `asChild`) that turns `data` into a file download.
export const DownloadTrigger = (
  props: React.ComponentProps<typeof ArkDownloadTrigger>
) => <ArkDownloadTrigger data-slot="download-trigger" {...props} />;
