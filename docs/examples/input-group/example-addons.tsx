import { LinkIcon } from "lucide-react";
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
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="api.example.com/sparql" />
      </InputGroup>

      <InputGroup>
        <InputGroupAddon>
          <LinkIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Endpoint" />
        <InputGroupAddon align="inline-end">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
