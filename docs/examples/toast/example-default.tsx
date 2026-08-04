"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <>
      <Button
        onClick={() =>
          toast.create({
            title: "Contract claimed",
            description: "Q-1041 · Something is eating the bell-ropes",
            type: "success",
          })
        }
        variant="outline"
      >
        Claim Q-1041
      </Button>

      <Toaster />
    </>
  );
}
