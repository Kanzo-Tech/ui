"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState<string | null>("2026-03-14T09:30");

  return (
    <div className="w-64">
      <DateField onChange={setValue} value={value} withTime />
      <p className="mt-2 font-mono text-muted-foreground text-xs">
        {value ?? "null"}
      </p>
    </div>
  );
}
