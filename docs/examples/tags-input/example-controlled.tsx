"use client";

import { useState } from "react";
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
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
} from "@kanzo-tech/ui";

const MAX = 4;

// A string list bound to state — the shape a form field takes. `max` is the machine's own: it
// stops accepting at the limit, so the value never has to be rejected after the fact.
export default function Example() {
  const [keywords, setKeywords] = useState(["salvage", "coastal"]);

  return (
    <Field className="w-80">
      <FieldLabel>Keywords</FieldLabel>
      <TagsInput max={MAX} onValueChange={(details) => setKeywords(details.value)} value={keywords}>
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
          <TagsInputInput placeholder="Add a keyword…" />
        </TagsInputControl>
      </TagsInput>
      <FieldHelper>
        {keywords.length} of {MAX}
      </FieldHelper>
    </Field>
  );
}
