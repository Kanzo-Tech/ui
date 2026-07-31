import { ark } from "@ark-ui/react/factory";
import {
  Popover as ArkPopover,
  usePopoverContext,
} from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { XIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";

export const usePopover = usePopoverContext;

export const Popover = (
  props: React.ComponentProps<typeof ArkPopover.Root>
) => {
  const {
    lazyMount = true,
    unmountOnExit = true,
    modal = true,
    ...rest
  } = props;

  return (
    <ArkPopover.Root
      lazyMount={lazyMount}
      modal={modal}
      unmountOnExit={unmountOnExit}
      {...rest}
    />
  );
};

export const PopoverTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkPopover.Trigger>
) => <ArkPopover.Trigger {...rest} data-slot={slot ?? "popover-trigger"} />;

export const PopoverAnchor = (
  { slot, ...rest }: React.ComponentProps<typeof ArkPopover.Anchor>
) => <ArkPopover.Anchor {...rest} data-slot={slot ?? "popover-anchor"} />;

const PopoverPositioner = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkPopover.Positioner>) => (
  <ArkPopover.Positioner {...rest} data-slot={slot ?? "popover-positioner"} />
);

interface PopoverContentProps
  extends React.ComponentProps<typeof ArkPopover.Content> {
  /**
   * Show close button at the top right corner.
   *
   * Off by default, unlike Dialog / Sheet / Tour: a popover dismisses on outside click and on
   * Escape, so the button is usually redundant chrome. Turn it on for a popover that holds a
   * form the reader might otherwise lose.
   *
   * (Upstream Shark documents `@default true` here while destructuring `= false` — the
   * behaviour is the same in both, only its JSDoc was wrong. Corrected, not changed.)
   *
   * @default false
   */
  showCloseButton?: boolean;
}

export const PopoverContent = (props: PopoverContentProps) => {
  const { showCloseButton = false, className, children, slot, ...rest } = props;

  return (
    <Portal>
      <PopoverPositioner>
        <ArkPopover.Content
          className={cn(
            "relative",
            "z-[calc(50+var(--layer-index,0))]",
            "[--space:--spacing(4)]",
            "w-auto min-w-32",
            "flex flex-col",
            "bg-popover",
            "text-popover-foreground",
            "rounded-xl border shadow-lg/5",
            "outline-hidden",
            "origin-(--transform-origin)",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-[98%] data-[state=open]:zoom-in-[98%]",
            "data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[placement=bottom]:slide-in-from-top-2",
            "data-[placement=left]:slide-in-from-end-2",
            "data-[placement=right]:slide-in-from-start-2",
            "data-[placement=top]:slide-in-from-bottom-2",
            "motion-reduce:animate-none!",
            className
          )}
          {...rest}
          data-slot={slot ?? "popover-content"}
        >
          {children}

          {!!showCloseButton && (
            <PopoverClose asChild>
              <Button
                aria-label="Close"
                // Aligned to the content padding: the button sits at 10px so the 16px icon
                // (6px inset inside the 28px icon-sm button) lands its corner on the 16px
                // `--space` grid — mirroring the header title on the opposite side.
                className="absolute inset-e-2.5 top-2.5 opacity-64 hover:opacity-100"
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </PopoverClose>
          )}
        </ArkPopover.Content>
      </PopoverPositioner>
    </Portal>
  );
};

interface PopoverHeaderProps extends React.ComponentProps<typeof ark.div> {
  /**
   * The description of the popover header
   */
  description?: string;
  /**
   * The title of the popover header
   */
  title?: string;
}

export const PopoverHeader = (props: PopoverHeaderProps) => {
  const { title, description, children, className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex flex-col gap-2 p-(--space)",
        "in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3",
        className
      )}
      {...rest}
      data-slot={slot ?? "popover-header"}
    >
      {!!title && <PopoverTitle>{title}</PopoverTitle>}
      {!!description && <PopoverDescription>{description}</PopoverDescription>}
      {!title && typeof children === "string" ? (
        <PopoverTitle>{children}</PopoverTitle>
      ) : (
        children
      )}
    </ark.div>
  );
};

export const PopoverTitle = (
  props: React.ComponentProps<typeof ArkPopover.Title>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkPopover.Title
      className={cn(
        "font-semibold text-base leading-none",
        // Reserve inline-end room so the absolutely-positioned close X never overlaps the title.
        "in-[[data-slot=popover-content]:has([data-slot=popover-close-trigger])]:pe-8",
        className
      )}
      {...rest}
      data-slot={slot ?? "popover-title"}
    />
  );
};

const PopoverDescription = (
  props: React.ComponentProps<typeof ArkPopover.Description>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkPopover.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...rest}
      data-slot={slot ?? "popover-description"}
    />
  );
};

export const PopoverBody = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ScrollArea>
      <ark.div
        className={cn(
          "flex-1",
          "p-(--space)",
          "overflow-auto",
          "in-[[data-slot=popover-content]:has([data-slot=popover-header])]:pt-1",
          "in-[[data-slot=popover-content]:has([data-slot=popover-footer]:not(.border-t))]:pb-1",
          className
        )}
        {...rest}
        data-slot={slot ?? "popover-body"}
      />
    </ScrollArea>
  );
};

export const PopoverFooter = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "sm:rounded-b-[calc(var(--radius-lg)-1px)]",
        "px-(--space) py-4",
        "border-t",
        className
      )}
      {...rest}
      data-slot={slot ?? "popover-footer"}
    />
  );
};

const PopoverClose = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkPopover.CloseTrigger>) => (
  <ArkPopover.CloseTrigger
    {...rest}
    data-slot={slot ?? "popover-close-trigger"}
  />
);

export const PopoverArrow = (
  props: React.ComponentProps<typeof ArkPopover.Arrow>
) => {
  const { style, slot, ...rest } = props;

  return (
    <ArkPopover.Arrow
      style={
        {
          "--arrow-background": "var(--popover)",
          "--arrow-size": "calc(1.5 * var(--spacing))",
          ...style,
        } as React.CSSProperties
      }
      {...rest}
      data-slot={slot ?? "popover-arrow"}
    >
      <ArkPopover.ArrowTip className="border-s border-t" />
    </ArkPopover.Arrow>
  );
};
