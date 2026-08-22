import { Portal } from "@ark-ui/react";
import {
  HoverCard as ArkHoverCard,
  useHoverCardContext,
} from "@ark-ui/react/hover-card";
import type React from "react";
import { cn } from "../lib/cn";

export const useHoverCard = useHoverCardContext;

interface HoverCardProps
  extends React.ComponentProps<typeof ArkHoverCard.Root> {}

export const HoverCard = (props: HoverCardProps) => {
  const {
    lazyMount = true,
    unmountOnExit = true,
    closeDelay = 100,
    openDelay = 10,
    positioning = { placement: "top" },
    ...rest
  } = props;

  return (
    <ArkHoverCard.Root
      closeDelay={closeDelay}
      lazyMount={lazyMount}
      openDelay={openDelay}
      positioning={positioning}
      unmountOnExit={unmountOnExit}
      {...rest}
    />
  );
};

export const HoverCardTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkHoverCard.Trigger>) => (
  <ArkHoverCard.Trigger {...rest} data-slot={slot ?? "hover-card-trigger"} />
);

export const HoverCardContent = (
  props: React.ComponentProps<typeof ArkHoverCard.Content>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <Portal>
      <ArkHoverCard.Positioner data-slot="hover-card-positioner">
        <ArkHoverCard.Content
          className={cn(
            "z-50",
            "w-64",
            "p-4",
            "bg-popover",
            "text-popover-foreground",
            "origin-(--transform-origin)",
            "rounded-box border shadow-lg/5",
            "outline-hidden",
            "data-[state=closed]:zoom-out-[98%] data-[state=open]:zoom-in-[98%]",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[placement=bottom]:slide-in-from-top-2",
            "data-[placement=left]:slide-in-from-end-2",
            "data-[placement=right]:slide-in-from-start-2",
            "data-[placement=top]:slide-in-from-bottom-2",
            "motion-reduce:animate-none!",
            className
          )}
          {...rest}
          data-slot={slot ?? "hover-card-content"}
        >
          {children}

          <HoverCardArrow />
        </ArkHoverCard.Content>
      </ArkHoverCard.Positioner>
    </Portal>
  );
};

export const HoverCardArrow = (
  props: React.ComponentProps<typeof ArkHoverCard.Arrow>
) => {
  const { style, slot, ...rest } = props;

  return (
    <ArkHoverCard.Arrow
      style={
        {
          "--arrow-background": "var(--popover)",
          "--arrow-size": "calc(1.5 * var(--spacing))",
          ...style,
        } as React.CSSProperties
      }
      {...rest}
      data-slot={slot ?? "hover-card-arrow"}
    >
      <ArkHoverCard.ArrowTip className="border-s border-t" />
    </ArkHoverCard.Arrow>
  );
};
