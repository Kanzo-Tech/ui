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
    title: "Welcome to the board",
    description: "Two steps, and you will know how a contract gets claimed.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "search",
    type: "tooltip",
    // A function, not a ref: the target is resolved when the step is shown, so it works for
    // elements that mount later in the flow.
    target: () => document.getElementById("tour-search"),
    title: "Find the contract",
    description: "Titles, regions and beasts all match here.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "claim",
    type: "tooltip",
    target: () => document.getElementById("tour-claim"),
    title: "Sign for it",
    description: "The party is committed until the contract settles.",
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

        <Input className="w-48" id="tour-search" placeholder="Search the board" />

        <Button id="tour-claim">Claim</Button>
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
