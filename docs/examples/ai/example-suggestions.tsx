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
  { value: "climate", rationale: "Recurs across every AEMET dataset." },
  { value: "meteorology", rationale: "The domain vocabulary uses this term." },
  { value: "observations", rationale: "Matches the source table name." },
  { value: "spain", rationale: "Every record carries an ES region code." },
  { value: "hourly", rationale: "Sampling interval declared in the schema." },
  { value: "temperature", rationale: "Present in 92% of rows." },
];

async function* suggest(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    if (signal?.aborted) return;
    yield item;
  }
}

export default function Example() {
  const [keywords, setKeywords] = useState<string[]>(["climate"]);

  return (
    <Field className="w-72">
      <FieldLabel>
        Keywords
        <SuggestRoot
          existing={keywords}
          onPick={(value) => setKeywords((prev) => [...prev, value])}
          suggest={suggest}
        >
          <SuggestTrigger className="ms-auto" label="Suggest keywords" />
          <SuggestContent />
        </SuggestRoot>
      </FieldLabel>
      <TagsInput onValueChange={(d) => setKeywords(d.value)} value={keywords}>
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
          <TagsInputInput placeholder="Add keyword…" />
        </TagsInputControl>
      </TagsInput>
    </Field>
  );
}
