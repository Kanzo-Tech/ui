"use client";

import { useState } from "react";
import { json } from "@codemirror/lang-json";
import { openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { FEATURED } from "@/example/quests";
import { CodeEditor } from "@kanzo-tech/ui/editor";

const CONTRACT = JSON.stringify(FEATURED.overdue, null, 2);

export default function Example() {
  const [value, setValue] = useState(CONTRACT);

  // Opened on mount so the panel is what you see. In an editor you actually use it is
  // Mod-F that opens it, and Escape that puts it away.
  const open = (view: EditorView | null) => {
    if (view) openSearchPanel(view);
  };

  return (
    <div className="w-full">
      <CodeEditor
        extensions={[json()]}
        lineNumbers
        maxHeight="24rem"
        minHeight="4rem"
        onChange={setValue}
        onView={open}
        value={value}
      />
    </div>
  );
}
