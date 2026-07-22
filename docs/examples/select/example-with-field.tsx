"use client";

import {
  createListCollection,
  Field,
  FieldDescription,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const visibility = createListCollection({
  items: [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
    { label: "Restricted", value: "restricted" },
  ],
});

export default function Example() {
  return (
    <Field className="w-56">
      <FieldLabel>Visibility</FieldLabel>
      <Select collection={visibility} defaultValue={["private"]}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select visibility" />
        </SelectTrigger>
        <SelectContent>
          {visibility.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>Who can see this dataset.</FieldDescription>
    </Field>
  );
}
