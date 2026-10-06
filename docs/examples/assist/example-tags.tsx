"use client";

import {
  Field,
  FieldHelper,
  FieldLabel,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemPreview,
  TagsInputItemText,
} from "@kanzo-tech/ui";
import { Assist, AssistProvider } from "@kanzo-tech/ai";
import { useState } from "react";
import { elements, mockModel } from "@/lib/mock-model";

// Stands in for `gateway("complete")`. It offers `livestock` too, and Assist drops it: a
// value the field already holds is never offered.
const model = mockModel(() =>
  elements([
    { text: "livestock", rationale: "A herd dog was taken." },
    { text: "standing-water", rationale: "Bog-hounds hold wet ground, and the ford is out." },
    { text: "night-work", rationale: "Both sightings were at dusk." },
    { text: "escort", rationale: "The herder walks back with the party." },
  ]),
);

export default function Example() {
  const [tags, setTags] = useState<string[]>(["livestock"]);

  return (
    <AssistProvider model={model}>
      <Field className="w-full max-w-md">
        <FieldLabel>Tags</FieldLabel>
        <Assist onValueChange={setTags} value={tags}>
          <TagsInput>
            <TagsInputControl>
              <TagsInputContext>
                {(api) =>
                  api.value.map((value, index) => (
                    <TagsInputItem index={index} key={value} value={value}>
                      <TagsInputItemPreview>
                        <TagsInputItemText>{value}</TagsInputItemText>
                        <TagsInputItemDeleteTrigger />
                      </TagsInputItemPreview>
                    </TagsInputItem>
                  ))
                }
              </TagsInputContext>
              <TagsInputInput placeholder="Add a tag…" />
            </TagsInputControl>
          </TagsInput>
        </Assist>
        <FieldHelper>How the board files the contract. A chip adds one.</FieldHelper>
      </Field>
    </AssistProvider>
  );
}
