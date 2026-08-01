"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";
import { isoDay } from "@/example/world";

export default function Example() {
  const [value, setValue] = useState<string | null>(isoDay(21));

  return (
    <div className="flex w-64 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <DateField key={size} onChange={setValue} size={size} value={value} />
      ))}
    </div>
  );
}
