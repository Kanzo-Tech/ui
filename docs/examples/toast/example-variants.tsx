"use client";

import { Button, Toaster, toast } from "@kanzo-tech/ui";

const TYPES = ["success", "error", "warning", "info", "loading"] as const;

export default function Example() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TYPES.map((type) => (
          <Button
            key={type}
            onClick={() => toast.create({ title: `A ${type} toast`, type })}
            size="sm"
            variant="outline"
          >
            {type}
          </Button>
        ))}
      </div>

      <Toaster />
    </>
  );
}
