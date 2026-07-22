"use client";

import { useState } from "react";
import { CardRadioGroup } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState("private");

  return (
    <div className="w-96">
      <CardRadioGroup
        onValueChange={setValue}
        options={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
          { value: "restricted", label: "Restricted" },
        ]}
        value={value}
      />
      <p className="mt-2 font-mono text-muted-foreground text-xs">{value}</p>
    </div>
  );
}
