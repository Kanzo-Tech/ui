"use client";

import { useState } from "react";
import { json } from "@codemirror/lang-json";
import { FEATURED } from "@/example/quests";
import { CodeEditor } from "@kanzo-tech/ui/editor";

const CONTRACT = JSON.stringify(FEATURED.overdue, null, 2);

export default function Example() {
  const [value, setValue] = useState(CONTRACT);

  return (
    // Sizes to the code, like a Textarea: `minHeight` is a small floor so an empty editor is
    // still clickable, `maxHeight` the ceiling past which `.cm-scroller` scrolls. Between them
    // it takes the height of its content — no dead space under the last line.
    <div className="w-full">
      <CodeEditor
        extensions={[json()]}
        lineNumbers
        maxHeight="24rem"
        minHeight="4rem"
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
