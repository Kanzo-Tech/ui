"use client";

import {
  Field,
  FieldLabel,
  SuggestContent,
  SuggestRoot,
  SuggestTrigger,
  type Suggestion,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
} from "@kanzo-tech/ui";
import { useState } from "react";

const POOL: Suggestion[] = [
  { value: "standing-water", rationale: "Bog-hounds hold wet ground, and the ford is out." },
  { value: "night-work", rationale: "Both sightings were at dusk." },
  { value: "bring-rope", rationale: "The causeway is under water below the lane." },
  { value: "escort", rationale: "The herder walks back with the party." },
  { value: "cartography", rationale: "Greenhollow has no current map of the lane." },
  { value: "second-attempt", rationale: "The hall posted this once already and it failed." },
];

async function* suggest(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    if (signal?.aborted) return;
    yield item;
  }
}

export default function Example() {
  const [tags, setTags] = useState<string[]>(["livestock"]);

  return (
    <Field className="w-72">
      <FieldLabel>
        Tags
        <SuggestRoot
          existing={tags}
          onPick={(value) => setTags((prev) => [...prev, value])}
          suggest={suggest}
        >
          <SuggestTrigger className="ms-auto" label="Suggest tags" />
          <SuggestContent />
        </SuggestRoot>
      </FieldLabel>
      <TagsInput onValueChange={(d) => setTags(d.value)} value={tags}>
        <TagsInputControl>
          <TagsInputContext>
            {(api) =>
              api.value.map((value, index) => (
                <TagsInputItem index={index} key={`${value}-${index}`} value={value}>
                  <TagsInputItemPreview>
                    <TagsInputItemText>{value}</TagsInputItemText>
                    <TagsInputItemDeleteTrigger />
                  </TagsInputItemPreview>
                  <TagsInputItemInput />
                </TagsInputItem>
              ))
            }
          </TagsInputContext>
          <TagsInputInput placeholder="Add tag…" />
        </TagsInputControl>
      </TagsInput>
    </Field>
  );
}
