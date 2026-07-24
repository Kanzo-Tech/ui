"use client";

import { ClientOnly as ArkClientOnly } from "@ark-ui/react/client-only";

// Renders `children` only after mount; `fallback` covers the SSR/first paint. Ark's ClientOnly
// is transparent (it renders `children`, not a host element), so there is no DOM node to slot.
export const ClientOnly = (
  props: React.ComponentProps<typeof ArkClientOnly>
) => <ArkClientOnly {...props} />;
