import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled>Default</Button>
      <Button disabled variant="outline">
        Outline
      </Button>
      <Button disabled variant="destructive">
        Destructive
      </Button>
    </div>
  );
}
