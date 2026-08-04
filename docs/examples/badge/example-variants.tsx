import { Badge } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Claimed</Badge>
      <Badge variant="secondary">Member</Badge>
      <Badge variant="outline">Invited</Badge>
      <Badge variant="success">Settled</Badge>
      <Badge variant="warning">Afield</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="info">Open</Badge>
    </div>
  );
}
