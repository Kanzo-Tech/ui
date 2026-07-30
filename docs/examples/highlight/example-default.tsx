"use client";

import { Highlight } from "@kanzo-tech/ui";
import { quest } from "@/example/quests";

export default function Example() {
  return (
    <p className="text-foreground text-sm">
      <Highlight query={["wyrm", "granary"]} text={quest("Q-1042").title} />
    </p>
  );
}
