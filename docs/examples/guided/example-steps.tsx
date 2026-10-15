"use client";

import { ChainOfThought, ChainOfThoughtStep, type ChainOfThoughtStatus } from "@kanzo-tech/ai";
import { Button, Eyebrow } from "@kanzo-tech/ui";
import { useState } from "react";

type Step = { id: string; label: string; description?: string; status: ChainOfThoughtStatus; action?: string };

const STEPS: Step[] = [
  { id: "read", label: "Read your files", description: "6 files, 4 of them tables", status: "complete" },
  { id: "match", label: "Match the columns to the questions", status: "active" },
  { id: "key", label: "Choose what identifies a prize", description: "Two columns could; it is yours to say", status: "waiting" },
  { id: "program", label: "Write the program", status: "pending", action: "Open in the editor" },
  { id: "graph", label: "Build your graph", status: "pending" },
];

export default function Example() {
  const [steps, setSteps] = useState(STEPS);

  // Advance the work by one: the present step is done, and the next becomes the present.
  const advance = () =>
    setSteps((all) => {
      const at = all.findIndex((s) => s.status === "active" || s.status === "waiting");
      if (at < 0) return STEPS;
      const next = all[at + 1];
      return all.map((s, i) => (i === at ? { ...s, status: "complete" } : s === next ? { ...s, status: i === 2 ? "waiting" : "active" } : s));
    });

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Eyebrow>What I am doing</Eyebrow>
      <ChainOfThought>
        {steps.map(({ id, action, ...step }) => (
          <ChainOfThoughtStep
            action={action && step.status !== "pending" ? <Button size="sm" variant="link">{action}</Button> : undefined}
            key={id}
            {...step}
          />
        ))}
      </ChainOfThought>
      <Button className="self-start" onClick={advance} size="sm" variant="outline">
        {steps.some((s) => s.status === "active" || s.status === "waiting") ? "Next step" : "Start the example again"}
      </Button>
    </div>
  );
}
