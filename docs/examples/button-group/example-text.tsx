import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@kanzo-tech/ui";
import { CopyIcon } from "lucide-react";

export default function Example() {
  return (
    <ButtonGroup aria-label="Contract">
      <ButtonGroupText>Q-1043</ButtonGroupText>
      <Button variant="outline">Nine goats, one road</Button>
      <ButtonGroupSeparator />
      <Button aria-label="Copy the contract id" size="icon-md" variant="outline">
        <CopyIcon />
      </Button>
    </ButtonGroup>
  );
}
