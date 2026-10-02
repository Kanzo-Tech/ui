"use client";

import { Button, ButtonGroup, ClientOnly, Skeleton, useKanzoTheme, type Appearance } from "@kanzo-tech/ui";

const CHOICES: { label: string; value: Appearance }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function AppearancePanel() {
  const { appearance, setAppearance } = useKanzoTheme();

  return (
    <div className="flex flex-col items-center gap-4">
      <ButtonGroup aria-label="Appearance">
        {CHOICES.map((choice) => (
          <Button
            key={choice.value}
            onClick={() => setAppearance(choice.value)}
            size="sm"
            variant={choice.value === appearance ? "default" : "outline"}
          >
            {choice.label}
          </Button>
        ))}
      </ButtonGroup>

      <p className="text-muted-foreground text-sm">Wearing the {appearance} side.</p>
    </div>
  );
}

export default function Example() {
  return (
    <ClientOnly fallback={<Skeleton className="h-20 w-64" />}>
      <AppearancePanel />
    </ClientOnly>
  );
}
