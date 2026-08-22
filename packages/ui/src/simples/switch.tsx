import { Switch as ArkSwitch, useSwitchContext } from "@ark-ui/react/switch";
import type React from "react";
import { cn } from "../lib/cn";

export const useSwitch = useSwitchContext;

export const Switch = (props: React.ComponentProps<typeof ArkSwitch.Root>) => {
  const { children, className, tabIndex, slot, ...rest } = props;

  return (
    <ArkSwitch.Root
      className={cn(
        "group/switch",
        "[--thumb-size:--spacing(5)] sm:[--thumb-size:--spacing(4)]",
        "inline-flex w-fit items-center gap-2",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "switch"}
    >
      {/* The track, and everything that used to be on the root.
          **It moved because the root has to be able to hold a label.** `children` were accepted by
          the type and rendered nowhere: the root is Ark's `<label for=…>` and carried the track's
          own box, so a caller passing text got a bare toggle with **no accessible name at all** —
          measured on `/docs/forms/switch`, whose own example passes one. WCAG 4.1.2, and the ring
          is the reason this is a part rather than a wrapper: on the root it would have drawn around
          the label too. */}
      <ArkSwitch.Control
        className={cn(
          "h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)]",
          "p-px",
          "flex shrink-0 items-center",
          "rounded-full border border-transparent",
          "transition-all",
          "outline-none group-data-[focus-visible]/switch:ring-[3px] group-data-invalid/switch:ring-[3px]",
          "group-data-[focus-visible]/switch:border-primary group-data-[focus-visible]/switch:ring-ring",
          "group-data-invalid/switch:border-destructive group-data-invalid/switch:ring-destructive/24",
          "group-data-[state=checked]/switch:bg-primary",
          // The track IS this control's boundary — `border` is transparent — and the thumb is
          // `bg-background`, so the track is the only thing that says the switch is off. A surface
          // step puts the thumb at ~1.07:1 against it and the off state stops being readable, which
          // is 1.4.11 asking about a *state*, not about a fill. Boundary contrast, spelled as a fill.
          "group-data-[state=unchecked]/switch:bg-input",
          "motion-reduce:transition-none!"
        )}
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

      {/* Not a second export: Shark ships `Switch` and `useSwitch` and nothing else, and this stays
          one component that renders its own parts — the same argument the docs page already makes
          about Control, Thumb and HiddenInput. */}
      {children === undefined ? null : (
        <ArkSwitch.Label className="text-sm leading-none" data-slot="switch-label">
          {children}
        </ArkSwitch.Label>
      )}

      <ArkSwitch.HiddenInput tabIndex={tabIndex} />
    </ArkSwitch.Root>
  );
};
