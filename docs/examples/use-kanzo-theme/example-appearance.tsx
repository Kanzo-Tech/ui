"use client";

import {
  Button,
  ButtonGroup,
  ClientOnly,
  Show,
  Skeleton,
  useKanzoTheme,
  type AppearancePref,
} from "@kanzo-tech/ui";

const CHOICES: { label: string; value: AppearancePref }[] = [
  { label: "System", value: "" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function AppearancePanel() {
  const { appearance, resolvedAppearance, setAppearance } = useKanzoTheme();

  return (
    <div className="flex flex-col items-center gap-4">
      <ButtonGroup aria-label="Appearance">
        {CHOICES.map((choice) => (
          <Button
            key={choice.label}
            onClick={() => setAppearance(choice.value)}
            size="sm"
            variant={choice.value === appearance ? "default" : "outline"}
          >
            {choice.label}
          </Button>
        ))}
      </ButtonGroup>

      <p className="text-muted-foreground text-sm">
        <Show
          fallback={<>Pinned to {appearance}.</>}
          when={!appearance}
        >
          Following the OS — resolved to {resolvedAppearance}.
        </Show>
      </p>
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
