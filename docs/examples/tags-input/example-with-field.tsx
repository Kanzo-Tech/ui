"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputHiddenInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Field className="w-80">
      <FieldLabel>Keywords</FieldLabel>
      <TagsInput defaultValue={["ingestion"]} name="keywords">
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
        <TagsInputHiddenInput />
      </TagsInput>
      <FieldDescription>Whatever you type becomes a value. Enter to add.</FieldDescription>
    </Field>
  );
}
