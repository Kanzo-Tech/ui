"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <>
      <Button
        onClick={() =>
          toast.create({
            title: "Contract abandoned",
            description: "Q-1058 · A basilisk, and it knows the route",
            type: "info",
            action: {
              label: "Undo",
              onClick: () =>
                toast.create({ title: "Back on the board", type: "success" }),
            },
          })
        }
        variant="outline"
      >
        Abandon contract
      </Button>

      <Toaster />
    </>
  );
}
