import { Button, ButtonGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <ButtonGroup aria-label="Contract actions">
      <Button variant="outline">Claim</Button>
      <Button variant="outline">Reassign</Button>
      <Button variant="outline">Abandon</Button>
    </ButtonGroup>
  );
}
