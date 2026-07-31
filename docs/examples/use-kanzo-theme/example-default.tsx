"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  ClientOnly,
  Skeleton,
  useKanzoTheme,
  type KanzoRadius,
} from "@kanzo-tech/ui";

const RADII: KanzoRadius[] = ["none", "xs", "sm", "md", "lg"];

// The preferences are browser state, so the readout is held back until mount — rendered on the
// server it would print the defaults and then swap to whatever this browser stored.
function ThemeReadout() {
  const { radius, density, font, resolvedAppearance, set } = useKanzoTheme();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="secondary">appearance: {resolvedAppearance}</Badge>
        <Badge variant="secondary">radius: {radius}</Badge>
        <Badge variant="secondary">density: {density}</Badge>
        <Badge variant="secondary">font: {font}</Badge>
      </div>

      <ButtonGroup aria-label="Corner radius">
        {RADII.map((value) => (
          <Button
            key={value}
            onClick={() => set({ radius: value })}
            size="sm"
            variant={value === radius ? "default" : "outline"}
          >
            {value}
          </Button>
        ))}
      </ButtonGroup>

      <p className="max-w-xs text-center text-muted-foreground text-sm">
        There is one provider per app, so this really does re-round the whole
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
