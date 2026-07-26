"use client";

import {
  createListCollection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";

const regions = createListCollection({
  items: [
    { label: "eu-west-1", value: "eu-west-1" },
    { label: "eu-central-1", value: "eu-central-1" },
    { label: "us-east-1", value: "us-east-1" },
    { label: "us-west-2", value: "us-west-2" },
    { label: "ap-south-1", value: "ap-south-1" },
  ],
});

export default function Example() {
  return (
    <Select collection={regions} defaultValue={["eu-west-1", "us-east-1"]} multiple>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Select regions" />
      </SelectTrigger>
      <SelectContent>
        {regions.items.map((item) => (
          <SelectItem item={item} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
