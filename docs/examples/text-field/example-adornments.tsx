import { SearchIcon } from "lucide-react";
import { InputGroupText, TextField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <TextField iconStart={<SearchIcon />} placeholder="Search datasets" />
      <TextField
        iconEnd={<InputGroupText>rows</InputGroupText>}
        placeholder="1000"
      />
      <TextField
        iconEnd={<InputGroupText>/sparql</InputGroupText>}
        iconStart={<InputGroupText>https://</InputGroupText>}
        placeholder="api.example.com"
      />
    </div>
  );
}
