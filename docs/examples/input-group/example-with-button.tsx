import { CopyIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <InputGroup className="w-80">
      <InputGroupInput defaultValue="urn:kanzo:customers" readOnly />
      <InputGroupAddon align="inline-end">
        <InputGroupButton aria-label="Copy" size="icon-xs">
          <CopyIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
