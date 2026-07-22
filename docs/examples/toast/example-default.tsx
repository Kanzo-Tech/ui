"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <>
      <Button
        onClick={() =>
          toast.create({
            title: "Dataset saved",
            description: "customers.ttl · 1,204 triples",
            type: "success",
          })
        }
        variant="outline"
      >
        Show toast
      </Button>

      <Toaster />
    </>
  );
}
