import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button isLoading>Claiming</Button>
      <Button isLoading variant="outline">
        Posting
      </Button>
    </div>
  );
}
