import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled>Claim</Button>
      <Button disabled variant="outline">
        Reassign
      </Button>
      <Button disabled variant="destructive">
        Abandon
      </Button>
    </div>
  );
}
