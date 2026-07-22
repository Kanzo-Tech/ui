"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState<string | null>("2026-03-14");

  return (
    <div className="flex w-64 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <DateField key={size} onChange={setValue} size={size} value={value} />
      ))}
    </div>
  );
}
