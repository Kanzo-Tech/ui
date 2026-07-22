"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <>
      <Button
        onClick={() =>
          toast.create({
            title: "Mapping deleted",
            description: "customers → Customer",
            type: "info",
            action: {
              label: "Undo",
              onClick: () => toast.create({ title: "Restored", type: "success" }),
            },
          })
        }
        variant="outline"
      >
        Delete mapping
      </Button>

      <Toaster />
    </>
  );
}
