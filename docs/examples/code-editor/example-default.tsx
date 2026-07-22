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
    // CodeMirror's own `.cm-scroller` does the scrolling; the shell needs a bounded height
    // to scroll inside, which `maxHeight` gives it here.
    <div className="w-full">
      <CodeEditor
        extensions={json()}
        lineNumbers
        maxHeight="260px"
        minHeight="180px"
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
