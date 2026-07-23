"use client";

import { Highlight } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <p className="text-foreground text-sm">
      <Highlight
        query={["Tailwind", "token"]}
        text="Ark UI + Tailwind, token-themed"
      />
    </p>
  );
}
