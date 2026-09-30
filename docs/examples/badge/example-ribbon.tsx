import { Badge, Button, Float } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="relative">
      <Button variant="outline">Export to Parquet</Button>
      <Float className="-end-2 -top-2" placement="top-end">
        <Badge size="xs" variant="info">
          Beta
        </Badge>
      </Float>
    </div>
  );
}
