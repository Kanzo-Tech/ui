"use client";

import { useId, useState } from "react";
import {
  Command,
  CommandContent,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemPreview,
  TagsInputItemText,
  TagsInputRootProvider,
  useFilter,
  useListCollection,
  useTagsInput,
} from "@kanzo-tech/ui";

const MEMBERS = [
  { label: "Ada", value: "ada", guild: "Smiths" },
  { label: "Brannoc", value: "brannoc", guild: "Smiths" },
  { label: "Cira", value: "cira", guild: "Scribes" },
  { label: "Dov", value: "dov", guild: "Scribes" },
];

/** A word with a colon is a filter, everything else is the name typed so far. */
const isFilter = (word: string) => /^guild:\S+$/.test(word);

export default function Example() {
  const id = useId();
  const [text, setText] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, set } = useListCollection({ initialItems: MEMBERS });

  const narrow = (typed: string, filters: string[]) => {
    const guilds = filters.map((f) => f.slice("guild:".length).toLowerCase());
    set(MEMBERS.filter((m) => contains(m.label, typed) && (guilds.length === 0 || guilds.includes(m.guild.toLowerCase()))));
  };

  // One input, two machines: the tags-input's props first, so the combobox's — its id, its value —
  // win, and both hear every key. The ids are shared for the same reason.
  const tags = useTagsInput({
    ids: { input: id },
    delimiter: " ",
    editable: false,
    validate: ({ inputValue }) => isFilter(inputValue),
    onValueChange: ({ value }) => {
      setText("");
      narrow("", value);
    },
  });

  // An `<input>`'s every attribute, `size` among them — which names the field's size variant here.
  const keys: Omit<ReturnType<typeof tags.getInputProps>, "size"> = tags.getInputProps();

  return (
    <TagsInputRootProvider className="h-80 w-full max-w-sm" value={tags}>
      <Command
        collection={collection}
        ids={{ input: id }}
        inputValue={text}
        onInputValueChange={({ inputValue }) => {
          setText(inputValue);
          narrow(inputValue, tags.value);
        }}
      >
        <CommandInput {...keys} autoFocus={false} placeholder="Type guild:Smiths, then a name…">
          {tags.value.map((value, index) => (
            <TagsInputItem index={index} key={value} value={value}>
              <TagsInputItemPreview>
                <TagsInputItemText>{value}</TagsInputItemText>
                <TagsInputItemDeleteTrigger />
              </TagsInputItemPreview>
            </TagsInputItem>
          ))}
        </CommandInput>
        <CommandContent>
          <CommandEmpty />
          <CommandList>
            {collection.items.map((item) => (
              <CommandItem item={item} key={item.value}>
                {item.label}
                <span className="ms-auto text-muted-foreground text-xs">{item.guild}</span>
              </CommandItem>
            ))}
          </CommandList>
        </CommandContent>
      </Command>
    </TagsInputRootProvider>
  );
}
