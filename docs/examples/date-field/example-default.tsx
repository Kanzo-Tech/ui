"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";
import { isoDay } from "@/example/world";

export default function Example() {
  const [value, setValue] = useState<string | null>(isoDay(21));

  return (
    <div className="w-64">
      <DateField onChange={setValue} value={value} />
      <p className="mt-2 font-mono text-muted-foreground text-xs">
        {value ?? "null"}
      </p>
    </div>
  );
}
