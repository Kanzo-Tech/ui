import { SearchIcon } from "lucide-react";
import { InputGroupText, TextField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <TextField iconStart={<SearchIcon />} placeholder="Search the board" />
      <TextField
        iconEnd={<InputGroupText>sightings</InputGroupText>}
        placeholder="3"
      />
      <TextField
        iconEnd={<InputGroupText>per day</InputGroupText>}
        iconStart={<InputGroupText>gold</InputGroupText>}
        placeholder="12"
      />
    </div>
  );
}
