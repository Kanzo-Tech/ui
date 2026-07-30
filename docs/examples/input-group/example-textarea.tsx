import { SendIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <InputGroup className="w-80">
      <InputGroupTextarea placeholder="Word for the party afield…" />
      <InputGroupAddon align="block-end">
        <InputGroupButton className="ms-auto" size="sm" variant="default">
          <SendIcon />
          Send
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
