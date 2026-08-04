import { Loader2Icon } from "lucide-react";
import { cn } from "../lib/cn";

export const Spinner = (props: React.ComponentProps<"svg">) => {
  const { "aria-label": ariaLabel, className, slot, ...rest } = props;

  return (
    <Loader2Icon
      aria-label={ariaLabel ?? "Loading"}
      className={cn("size-4 animate-spin", className)}
      role="status"
      {...rest}
      data-slot={slot ?? "spinner"}
    />
  );
};
