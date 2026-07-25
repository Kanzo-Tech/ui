import { Button, Spinner } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-end gap-8">
        <Spinner className="size-4" />
        <Spinner className="size-6" />
        <Spinner className="size-8" />
      </div>
      <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner />
        Reconciling 1,204 triples…
      </span>
      <Button isLoading>Publishing</Button>
    </div>
  );
}
