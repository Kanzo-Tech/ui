"use client";

import { BoxesIcon } from "lucide-react";
import { SidebarIdentity } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-64 flex-col gap-4">
      <SidebarIdentity
        data={{
          label: "Ángel Iglesias",
          description: "angel@kanzo.tech",
          fallback: "ÁI",
        }}
      />
      {/* An `icon` swaps the round avatar for a square brand tile — the shape that reads as
          a workspace or org rather than a person. */}
      <SidebarIdentity
        data={{
          label: "Kanzo",
          description: "Owner",
          icon: <BoxesIcon />,
        }}
      />
    </div>
  );
}
