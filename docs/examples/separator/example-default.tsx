import { Separator } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-72 space-y-3 text-sm">
      <p>Dataset</p>
      <Separator />
      <p className="text-muted-foreground">1,204 triples</p>
    </div>
  );
}
