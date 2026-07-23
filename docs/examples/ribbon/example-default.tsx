import { Button, Ribbon } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Ribbon label="Beta" variant="info">
      <Button variant="outline">Export to Parquet</Button>
    </Ribbon>
  );
}
