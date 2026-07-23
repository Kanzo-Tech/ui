import { Button, Ribbon } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Ribbon disabled label="Coming soon">
      <Button variant="outline">Export to Parquet</Button>
    </Ribbon>
  );
}
