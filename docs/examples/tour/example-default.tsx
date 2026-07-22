"use client";

import {
  Button,
  Input,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourProgressText,
  TourTitle,
  TourTrigger,
  type TourStepType,
} from "@kanzo-tech/ui";

const steps: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome to the editor",
    description: "A quick two-step tour of the dataset tools.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "name",
    type: "tooltip",
    // A function, not a ref: the target is resolved when the step is shown, so it works for
    // elements that mount later in the flow.
    target: () => document.getElementById("tour-name"),
    title: "Name your dataset",
    description: "The name becomes the graph id, so it has to be unique.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "save",
    type: "tooltip",
    target: () => document.getElementById("tour-save"),
    title: "Save your work",
    description: "That is the whole tour.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Done", action: "dismiss" },
    ],
  },
];

export default function Example() {
  return (
    <Tour steps={steps}>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <TourTrigger asChild>
          <Button variant="outline">Start tour</Button>
        </TourTrigger>

        <Input className="w-48" id="tour-name" placeholder="customers" />

        <Button id="tour-save">Save</Button>
      </div>

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
