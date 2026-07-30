"use client";

import {
  Badge,
  Button,
  Input,
  Show,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourTitle,
  useTourContext,
  type TourStepType,
} from "@kanzo-tech/ui";

const steps: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome",
    description: "Two steps, driven by a control that is not a TourTrigger.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "name",
    type: "tooltip",
    target: () => document.getElementById("hook-tour-name"),
    title: "Name your dataset",
    description: "The readout below is reading the same tour instance.",
    actions: [{ label: "Done", action: "dismiss" }],
  },
];

// `handleStart` is what `TourTrigger` calls. Reaching for it directly is how a control that
// cannot be a trigger — a menu item, a keyboard shortcut, an onboarding effect — starts the tour.
function Panel() {
  const { tour, handleStart } = useTourContext();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge variant="secondary">open: {String(tour.open)}</Badge>
        <Badge variant="secondary">step: {tour.step?.id ?? "—"}</Badge>
        <Badge variant="secondary">
          {tour.stepIndex + 1} / {tour.totalSteps}
        </Badge>
      </div>

      <Input className="w-56" id="hook-tour-name" placeholder="customers" />

      <Show
        fallback={
          <p className="text-muted-foreground text-sm">Tour in progress…</p>
        }
        when={!tour.open}
      >
        <Button onClick={handleStart} variant="outline">
          Start from anywhere
        </Button>
      </Show>
    </div>
  );
}

export default function Example() {
  return (
    <Tour steps={steps}>
      <Panel />

      <TourContent>
        <TourHeader className="pb-0">
          <TourTitle />
          <TourDescription />
        </TourHeader>
        <TourActions />
      </TourContent>
    </Tour>
  );
}
