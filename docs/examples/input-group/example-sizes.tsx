import { SearchIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <InputGroup key={size} size={size}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder={size} />
        </InputGroup>
      ))}
    </div>
  );
}
