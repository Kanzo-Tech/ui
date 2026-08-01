import { UsersIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Kbd,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>Q-</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="1041" />
      </InputGroup>

      <InputGroup>
        <InputGroupAddon>
          <UsersIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Find a member" />
        <InputGroupAddon align="inline-end">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
