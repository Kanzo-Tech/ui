"use client";

import { CORE_PREFS, prefOptions } from "@kanzo-tech/theme";
import {
  Badge,
  Button,
  ButtonGroup,
  ClientOnly,
  Skeleton,
  useKanzoTheme,
  type KanzoDensity,
} from "@kanzo-tech/ui";

const DENSITIES = prefOptions(CORE_PREFS.density) ?? [];

// The preferences are browser state, so the readout is held back until mount — rendered on the
// server it would print the defaults and then swap to whatever this browser stored.
function ThemeReadout() {
  const { appearance, density, resolvedTheme, set } = useKanzoTheme();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="secondary">appearance: {appearance}</Badge>
        <Badge variant="secondary">theme: {resolvedTheme}</Badge>
        <Badge variant="secondary">density: {density}</Badge>
      </div>

      <ButtonGroup aria-label="Density">
        {DENSITIES.map(({ label, value }) => (
          <Button
            key={value}
            onClick={() => set({ density: value as KanzoDensity })}
            size="sm"
            variant={value === density ? "default" : "outline"}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>

      <p className="max-w-xs text-center text-muted-foreground text-sm">
        There is one provider per app, so this really does rescale the whole
        page — and persists.
      </p>
    </div>
  );
}

export default function Example() {
  return (
    <ClientOnly fallback={<Skeleton className="h-32 w-72" />}>
      <ThemeReadout />
    </ClientOnly>
  );
}
