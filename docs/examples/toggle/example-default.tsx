"use client";

import { Toggle } from "@kanzo-tech/ui";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { useState } from "react";

/**
 * A real formatting toolbar — controlled, so the pressed state is the actual document state,
 * not just a visual. This is what a Toggle is for; a lone unbound one demonstrates the API but
 * not the use.
 */
export default function Example() {
  const [marks, setMarks] = useState({ bold: true, italic: false, underline: false });
  const toggle = (k: keyof typeof marks) => (pressed: boolean) =>
    setMarks((m) => ({ ...m, [k]: pressed }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <Toggle aria-label="Bold" onPressedChange={toggle("bold")} pressed={marks.bold}>
          <BoldIcon />
        </Toggle>
        <Toggle aria-label="Italic" onPressedChange={toggle("italic")} pressed={marks.italic}>
          <ItalicIcon />
        </Toggle>
        <Toggle
          aria-label="Underline"
          onPressedChange={toggle("underline")}
          pressed={marks.underline}
        >
          <UnderlineIcon />
        </Toggle>
      </div>

      <p
        className="text-sm"
        style={{
          fontWeight: marks.bold ? 700 : 400,
          fontStyle: marks.italic ? "italic" : "normal",
          textDecoration: marks.underline ? "underline" : "none",
        }}
      >
        The quick brown fox.
      </p>
    </div>
  );
}
