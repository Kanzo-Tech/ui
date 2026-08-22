"use client";

import { ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { useState } from "react";

/** Two groups, because the choice `multiple` makes is the whole of `ToggleGroup`: marks are
 *  independent and any number can be on, alignment is one-of-three and `multiple={false}` is what
 *  says so. `spacing={0}` is the default and is why the first group reads as one segmented control
 *  — the items lose their inner radii and share a border. */
export default function Example() {
  const [marks, setMarks] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState<string[]>(["left"]);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <ToggleGroup
        aria-label="Text style"
        onValueChange={(details) => setMarks(details.value)}
        value={marks}
        variant="outline"
      >
        <ToggleGroupItem aria-label="Bold" value="bold">
          <BoldIcon />
        </ToggleGroupItem>
        <ToggleGroupItem aria-label="Italic" value="italic">
          <ItalicIcon />
        </ToggleGroupItem>
        <ToggleGroupItem aria-label="Underline" value="underline">
          <UnderlineIcon />
        </ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        aria-label="Alignment"
        multiple={false}
        onValueChange={(details) => setAlign(details.value)}
        spacing={1}
        value={align}
      >
        <ToggleGroupItem aria-label="Left" value="left">
          <AlignLeftIcon />
        </ToggleGroupItem>
        <ToggleGroupItem aria-label="Centre" value="center">
          <AlignCenterIcon />
        </ToggleGroupItem>
        <ToggleGroupItem aria-label="Right" value="right">
          <AlignRightIcon />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
