"use client";

import { useState } from "react";
import { DateField } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState<string | null>("2019-01-01");

  return (
    <div className="flex w-64 flex-col gap-3">
      <DateField invalid onChange={setValue} value={value} />
      <DateField disabled onChange={setValue} value={value} />
    </div>
  );
}
