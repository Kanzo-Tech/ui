"use client";

import {
  Button,
  ButtonGroup,
  Show,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourProgressText,
  TourTitle,
  useTourContext,
  type TourStepType,
} from "@kanzo-tech/ui";

const steps: TourStepType[] = [
  {
    id: "one",
    type: "dialog",
    title: "Connect a source",
    description: "The first step.",
    actions: [{ label: "Next", action: "next" }],
  },
  {
    id: "two",
    type: "dialog",
    title: "Map the columns",
    description: "The second step.",
    actions: [{ label: "Next", action: "next" }],
  },
  {
    id: "three",
    type: "dialog",
    title: "Publish",
    description: "The last step.",
    actions: [{ label: "Done", action: "dismiss" }],
  },
];

// `handleStart` always begins at step one. `tour.start(id)` is the Ark instance underneath, which
// is what a "resume where you left off" control needs — the context carries both.
function Launcher() {
  const { tour, handleStart } = useTourContext();

  return (
    <Show
      fallback={
        <p className="text-muted-foreground text-sm">Tour in progress…</p>
      }
      when={!tour.open}
    >
      <ButtonGroup aria-label="Start the tour">
        <Button onClick={handleStart} size="sm" variant="outline">
          From the start
        </Button>
        <Button onClick={() => tour.start("two")} size="sm" variant="outline">
          Resume at step 2
        </Button>
        <Button onClick={() => tour.start("three")} size="sm" variant="outline">
          Skip to the end
        </Button>
      </ButtonGroup>
    </Show>
  );
}

export default function Example() {
  return (
    <Tour steps={steps}>
      <Launcher />

      <TourContent>
        <TourHeader className="pb-0">
          <TourTitle />
          <TourDescription />
        </TourHeader>

        <TourProgressText className="px-(--space)" />

        <TourActions />
      </TourContent>
    </Tour>
  );
}
