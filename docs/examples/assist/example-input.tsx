"use client";

import { Field, FieldHelper, FieldLabel, Input } from "@kanzo-tech/ui";
import { Assist, AssistProvider } from "@kanzo-tech/ai";
import { useState } from "react";
import { elements, mockModel } from "@/lib/mock-model";

const TITLES = [
  [
    { text: "Bog-hounds on the Greenhollow causeway", rationale: "Names the beast and the place." },
    { text: "Herd dog taken at the ford", rationale: "Leads with what was lost." },
    { text: "Standing water below the lane", rationale: "Leads with the hazard." },
  ],
  [
    { text: "Second call: bog-hounds, Greenhollow", rationale: "The hall posted this once already." },
    { text: "Three hounds at the ford", rationale: "Says how many, which is what a party asks first." },
    { text: "Greenhollow wants its causeway back", rationale: "Puts the hall's ask first." },
  ],
];

// Stands in for `gateway("complete")`; each press of the ✨ asks for a different set.
const model = mockModel((_, i) => elements(TITLES[i % TITLES.length] ?? []));

export default function Example() {
  const [title, setTitle] = useState("Bog-hounds took the herd dog");

  return (
    <AssistProvider model={model}>
      <Field className="w-full max-w-md">
        <FieldLabel>Title</FieldLabel>
        <Assist onValueChange={setTitle} value={title}>
          <Input placeholder="e.g. A wyrm under the granary" />
        </Assist>
        <FieldHelper>The line the board shows. A chip replaces it; the ✨ puts it back.</FieldHelper>
      </Field>
    </AssistProvider>
  );
}
