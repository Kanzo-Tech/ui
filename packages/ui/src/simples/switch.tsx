import { Switch as ArkSwitch, useSwitchContext } from "@ark-ui/react/switch";
import type React from "react";
import { cn } from "../lib/cn";

export const useSwitch = useSwitchContext;

export const Switch = (props: React.ComponentProps<typeof ArkSwitch.Root>) => {
  const { className, tabIndex, slot, ...rest } = props;

  return (
    <ArkSwitch.Root
      className={cn(
        "group/switch",
        "[--thumb-size:--spacing(5)] sm:[--thumb-size:--spacing(4)]",
        "h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)]",
        "p-px",
        "inline-flex shrink-0 items-center",
        "rounded-full border border-transparent",
        "transition-all",
        "outline-none [[data-focus-visible],[data-invalid]]:ring-[3px]",
        "data-focus-visible:border-primary data-focus-visible:ring-ring",
        "data-invalid:border-destructive data-invalid:ring-destructive/24",
        "data-[state=checked]:bg-primary",
        // The track IS this control's boundary — `border` is transparent — and the thumb is
        // `bg-background`, so the track is the only thing that says the switch is off. A surface
        // step puts the thumb at ~1.07:1 against it and the off state stops being readable, which
        // is 1.4.11 asking about a *state*, not about a fill. Boundary contrast, spelled as a fill.
        "data-[state=unchecked]:bg-input",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "motion-reduce:transition-none!",
        className
      )}
      {...rest}
      data-slot={slot ?? "switch"}
    >
      <ArkSwitch.Control
        className="flex size-full items-center"
        data-slot="switch-control"
      >
        <ArkSwitch.Thumb
          className={cn(
            "block",
            "aspect-square h-full w-auto",
            "bg-background",
            "rounded-full ring-0",
            "pointer-events-none",
            "transition-transform",
            "data-[state=checked]:translate-x-[calc(var(--thumb-size)-4px)]",
            "dark:data-[state=checked]:bg-primary-foreground",
            "data-[state=unchecked]:translate-x-0",
            "dark:data-[state=unchecked]:bg-foreground",
            "motion-reduce:transition-none!"
          )}
          data-slot="switch-thumb"
        />
      </ArkSwitch.Control>

      <ArkSwitch.HiddenInput tabIndex={tabIndex} />
    </ArkSwitch.Root>
  );
};
