import { Skeleton } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
