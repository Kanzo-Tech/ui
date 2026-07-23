"use client";

import { useState } from "react";
import { json } from "@codemirror/lang-json";
import { CodeEditor } from "@kanzo-tech/ui/editor";

const SAMPLE = `{
  "dataset": "aemet.fossil",
  "keywords": ["weather", "spain"],
  "issued": "2026-01-14"
}`;

export default function Example() {
  const [value, setValue] = useState(SAMPLE);

  return (
    // Sizes to the code, like a Textarea: `minHeight` is a small floor so an empty editor is
    // still clickable, `maxHeight` the ceiling past which `.cm-scroller` scrolls. Between them
    // it takes the height of its content — no dead space under the last line.
    <div className="w-full">
      <CodeEditor
        extensions={json()}
        lineNumbers
        maxHeight="24rem"
        minHeight="4rem"
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
