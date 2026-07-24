import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@kanzo-tech/ui";
import { CopyIcon } from "lucide-react";

export default function Example() {
  return (
    <ButtonGroup aria-label="Endpoint">
      <ButtonGroupText>https://</ButtonGroupText>
      <Button variant="outline">api.kanzo.tech</Button>
      <ButtonGroupSeparator />
      <Button aria-label="Copy" size="icon-md" variant="outline">
        <CopyIcon />
      </Button>
    </ButtonGroup>
  );
}
