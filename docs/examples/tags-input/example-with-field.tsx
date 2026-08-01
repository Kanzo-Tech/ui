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
      <FieldLabel>Tags</FieldLabel>
      <TagsInput defaultValue={["escort"]} name="tags">
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
        <TagsInputHiddenInput />
      </TagsInput>
      <FieldDescription>Whatever the poster types becomes a tag. Enter to add.</FieldDescription>
    </Field>
  );
}
