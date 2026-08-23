"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
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
import { SuggestList, SuggestMark, SuggestRoot, type Candidate } from "@kanzo-tech/ai";
import { useState } from "react";

const POOL: Candidate[] = [
  { value: "standing-water", rationale: "Bog-hounds hold wet ground, and the ford is out." },
  { value: "night-work", rationale: "Both sightings were at dusk." },
  { value: "bring-rope", rationale: "The causeway is under water below the lane." },
  { value: "escort", rationale: "The herder walks back with the party." },
  { value: "cartography", rationale: "Greenhollow has no current map of the lane." },
  { value: "second-attempt", rationale: "The hall posted this once already and it failed." },
];

async function* suggest(signal?: AbortSignal): AsyncIterable<Candidate> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    if (signal?.aborted) return;
    yield item;
  }
}

const TITLES: Candidate[] = [
  { value: "Bog-hounds on the Greenhollow causeway", rationale: "Names the beast and the place." },
  { value: "Herd dog taken at the ford", rationale: "Leads with what was lost." },
  { value: "Standing water below the lane", rationale: "Leads with the hazard." },
  { value: "Second call: bog-hounds, Greenhollow", rationale: "The hall posted this once already." },
];

async function* suggestTitle(signal?: AbortSignal): AsyncIterable<Candidate> {
  for (const item of TITLES) {
    await new Promise((r) => setTimeout(r, 200));
    if (signal?.aborted) return;
    yield item;
  }
}

export default function Example() {
  const [tags, setTags] = useState<string[]>(["livestock"]);
  const [title, setTitle] = useState("Bog-hounds took the herd dog");

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
    <Field>
      <FieldLabel>Title</FieldLabel>
      {/* One line, so candidates — a continuation over an `<input>` can only show what fits in the
          width that is left. The ✨ sits in the group; the candidates land under the field. */}
      <SuggestRoot existing={[title]} onPick={setTitle} suggest={suggestTitle}>
        <InputGroup>
          <InputGroupInput
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. A wyrm under the granary"
            value={title}
          />
          <InputGroupAddon align="inline-end">
            <SuggestMark label="Suggest a title" />
          </InputGroupAddon>
        </InputGroup>
        <SuggestList />
      </SuggestRoot>
      <FieldDescription>Whole values to pick from — the field keeps its own.</FieldDescription>
    </Field>

    <Field className="w-72">
      <FieldLabel>Tags</FieldLabel>
      {/* The ✨ sits in the control, at the end of the row the tags flow along — the same place
          `CompleteMark` sits. The candidates land underneath, where the field's helper text goes,
          and only while the field has focus. */}
      <SuggestRoot
        existing={tags}
        onPick={(value) => setTags((prev) => [...prev, value])}
        suggest={suggest}
      >
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
            <SuggestMark label="Suggest tags" />
          </TagsInputControl>
        </TagsInput>
        <SuggestList />
      </SuggestRoot>
    </Field>
    </div>
  );
}
