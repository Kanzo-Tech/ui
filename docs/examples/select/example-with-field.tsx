"use client";

import { GRADES } from "@/example/world";
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

const grades = createListCollection({
  items: GRADES.map((grade) => ({
    label: `${grade.value} — ${grade.label}`,
    value: String(grade.value),
  })),
});

export default function Example() {
  return (
    <Field className="w-56">
      <FieldLabel>Grade</FieldLabel>
      <Select collection={grades} defaultValue={["3"]}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a grade" />
        </SelectTrigger>
        <SelectContent>
          {grades.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>
        A writ needs a hall's seal and four signatures.
      </FieldDescription>
    </Field>
  );
}
