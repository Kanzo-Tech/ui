"use client";

import { ark } from "@ark-ui/react/factory";
import { cn } from "../lib/cn";

export const Skeleton = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "rounded-md bg-muted",
        "animate-pulse",
        "motion-reduce:animate-none!",
        className
      )}
      data-slot="skeleton"
      {...rest}
    />
  );
};

// There is no `SkeletonCircle` or `SkeletonText`. A circle is `size-10 shrink-0 rounded-full`
// on this one — rung 1 of the ladder, and `examples/skeleton/example-default.tsx` was already
// writing it that way rather than importing the part. `SkeletonText` was worse than redundant:
// it forced every line to `h-4` via `**:[div]:h-4` and the last to `w-3/4`, neither reachable
// from the root's `className`, so the only shape it could draw is not the one the sole real
// caller wanted (`h-3`, `w-2/3`). Repeating a `Skeleton` is a `.map`, not an export.
