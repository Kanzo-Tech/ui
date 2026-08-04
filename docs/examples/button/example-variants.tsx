import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Claim</Button>
      <Button variant="secondary">Reassign</Button>
      <Button variant="outline">Post a contract</Button>
      <Button variant="ghost">Watch</Button>
      <Button variant="destructive">Abandon</Button>
      <Button variant="link">Read the charter</Button>
    </div>
  );
}
