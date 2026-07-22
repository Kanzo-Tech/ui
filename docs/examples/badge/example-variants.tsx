import { Badge } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Mapped</Badge>
      <Badge variant="warning">Partial</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  );
}
