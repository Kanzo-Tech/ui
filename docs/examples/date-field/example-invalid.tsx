"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";
import { isoDay } from "@/example/world";

export default function Example() {
  // Six days past due — the date the overdue basilisk contract was meant to come back on.
  const [value, setValue] = useState<string | null>(isoDay(-6));

  return (
    <div className="flex w-64 flex-col gap-3">
      <DateField invalid onChange={setValue} value={value} />
      <DateField disabled onChange={setValue} value={value} />
    </div>
  );
}
