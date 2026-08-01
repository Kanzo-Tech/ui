"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

const TYPES = [
  {
    type: "success",
    title: "Contract settled",
    description: "Q-1043 · Nine goats, one road",
  },
  {
    type: "error",
    title: "The party was rejected",
    description: "A writ may not be signed by fewer than four, one of them a warden.",
  },
  {
    type: "warning",
    title: "Six days overdue",
    description: "Q-1058 · A basilisk, and it knows the route",
  },
  {
    type: "info",
    title: "Posted to the board",
    description: "Q-1084 · Whatever walks the causeway, it is not a lamp",
  },
  {
    type: "loading",
    title: "Checking the standing orders…",
    description: "Four rules, against every live contract",
  },
] as const;

export default function Example() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TYPES.map((entry) => (
          <Button
            key={entry.type}
            onClick={() => toast.create(entry)}
            size="sm"
            variant="outline"
          >
            {entry.type}
          </Button>
        ))}
      </div>

      <Toaster />
    </>
  );
}
