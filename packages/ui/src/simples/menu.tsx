import { Portal } from "@ark-ui/react";
import { ark } from "@ark-ui/react/factory";
import {
  Menu as ArkMenu,
  type MenuContentProps,
  useMenuContext,
} from "@ark-ui/react/menu";
import { CheckIcon, ChevronRight } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export { useMenuContext as useMenu };

export const Menu = (props: React.ComponentProps<typeof ArkMenu.Root>) => {
  const {
    lazyMount = true,
    positioning = { placement: "bottom-end" },
    unmountOnExit = true,
    ...rest
  } = props;

  return (
    <ArkMenu.Root
      lazyMount={lazyMount}
      positioning={positioning}
      unmountOnExit={unmountOnExit}
      {...rest}
    />
  );
};

export const MenuTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkMenu.Trigger>
) => <ArkMenu.Trigger {...rest} data-slot={slot ?? "menu-trigger"} />;

/**
 * The second way into the same menu: opens on right-click at the pointer instead of anchoring to
 * a control. `cursor-default` because the region is not a link or a button and must not look like
 * one — the affordance is the right-click, not the cursor.
 */
export const MenuContextTrigger = (
  props: React.ComponentProps<typeof ArkMenu.ContextTrigger>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkMenu.ContextTrigger
      className={cn("cursor-default", className)}
      {...rest}
      data-slot={slot ?? "menu-context-trigger"}
    />
  );
};

export const MenuPositioner = (
  props: React.ComponentProps<typeof ArkMenu.Positioner>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkMenu.Positioner
      className={cn("outline-none", className)}
      {...rest}
      data-slot={slot ?? "menu-positioner"}
    />
  );
};

export const menuContentVariants = tv({
  base: [
    "z-[calc(50+var(--nested-layer-count,0))]",
    // A FIXED max-height, not `max-h-(--available-height)`: clamping the content to the
    // floating-ui `size` var feeds the element's own resize back into autoUpdate — content
    // shrinks → scrollbar toggles → available space changes → recompute → loop, which hard-
    // freezes the tab. A fixed cap is decoupled from the measurement.
    "max-h-96 overflow-y-auto not-[class*='w-']:min-w-32",
    "p-1",
    "bg-popover",
    "text-popover-foreground",
    "rounded-xl border shadow-lg/5",
    "origin-(--transform-origin)",
    "outline-none",
    "overflow-y-auto",
    "duration-100",
    "data-[state=open]:animate-in",
    "data-[state=open]:fade-in-0",
    "data-[state=open]:zoom-in-[98%]",
    "data-[placement=bottom]:slide-in-from-top-2",
    "data-[placement=left]:slide-in-from-end-2",
    "data-[placement=right]:slide-in-from-start-2",
    "data-[placement=top]:slide-in-from-bottom-2",
    "motion-reduce:animate-none!",
  ],
});

export const MenuContent = (props: MenuContentProps) => {
  const { className, children, slot, ...rest } = props;

  return (
    <Portal>
      <MenuPositioner>
        <ArkMenu.Content
          className={cn(menuContentVariants(), className)}
          {...rest}
          data-slot={slot ?? "menu-content"}
        >
          {children}
        </ArkMenu.Content>
      </MenuPositioner>
    </Portal>
  );
};

interface MenuGroupProps
  extends React.ComponentProps<typeof ArkMenu.ItemGroup> {
  /**
   * The heading of the menu item group.
   */
  heading?: string;
}

export const MenuGroup = (props: MenuGroupProps) => {
  const { heading, children, slot, ...rest } = props;

  return (
    <ArkMenu.ItemGroup {...rest} data-slot={slot ?? "menu-group"}>
      {!!heading && <MenuGroupLabel>{heading}</MenuGroupLabel>}

      {children}
    </ArkMenu.ItemGroup>
  );
};

export const MenuSeparator = (
  props: React.ComponentProps<typeof ArkMenu.Separator>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkMenu.Separator
      className={cn("my-1 h-px bg-border", className)}
      {...rest}
      data-slot={slot ?? "menu-separator"}
    />
  );
};

const menuItemVariants = tv({
  base: [
    "group/menu-item",
    "relative",
    "w-full",
    "px-2.5 py-1.5",
    "flex items-center gap-2",
    "select-none text-sm",
    "rounded-lg",
    "outline-hidden",
    "group-data-[date=open]/trigger-item:bg-accent group-data-[date=open]/trigger-item:text-accent-foreground",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  variants: {
    variant: {
      default: [
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
      ],
      destructive: [
        "text-destructive dark:text-destructive-foreground",
        "data-highlighted:bg-destructive-wash-strong",
        "**:[svg]:text-destructive! dark:**:[svg]:text-destructive-foreground!",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface MenuItemProps
  extends React.ComponentProps<typeof ArkMenu.Item>,
    VariantProps<typeof menuItemVariants> {}

export const MenuItem = (props: MenuItemProps) => {
  const { variant = "default", className, ...rest } = props;

  return (
    <ArkMenu.Item
      className={cn(menuItemVariants({ variant }), className)}
      data-variant={variant}
      {...rest}
    />
  );
};

export const MenuQuickItem = (props: MenuItemProps) => {
  const { variant = "default", className, ...rest } = props;

  return (
    <ArkMenu.Item
      className={cn(
        menuItemVariants({ variant }),
        "flex-col gap-1",
        "[&_svg:not([class*='size-'])]:size-4.5",
        className
      )}
      {...rest}
    />
  );
};

export const MenuCheckboxItem = (
  props: React.ComponentProps<typeof ArkMenu.CheckboxItem>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkMenu.CheckboxItem
      className={cn(
        menuItemVariants({ variant: "default" }),
        "ps-8",
        className
      )}
      {...rest}
    >
      <ArkMenu.ItemIndicator
        className={cn(
          "absolute inset-s-2",
          "size-3.5",
          "flex items-center justify-center",
          "pointer-events-none"
        )}
      >
        <CheckIcon />
      </ArkMenu.ItemIndicator>

      <ArkMenu.ItemText>{children}</ArkMenu.ItemText>
    </ArkMenu.CheckboxItem>
  );
};

interface MenuRadioGroupProps
  extends React.ComponentProps<typeof ArkMenu.RadioItemGroup> {
  /**
   * The heading of the menu radio item group.
   */
  heading?: string;
}

export const MenuRadioGroup = (props: MenuRadioGroupProps) => {
  const { heading, children, slot, ...rest } = props;

  return (
    <ArkMenu.RadioItemGroup {...rest} data-slot={slot ?? "menu-radio-group"}>
      {!!heading && <MenuGroupLabel>{heading}</MenuGroupLabel>}

      {children}
    </ArkMenu.RadioItemGroup>
  );
};

export const MenuGroupLabel = (
  props: React.ComponentProps<typeof ArkMenu.ItemGroupLabel>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkMenu.ItemGroupLabel
      className={cn(
        "px-2 py-1.5",
        "font-medium text-muted-foreground text-sm",
        "pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "menu-group-label"}
    />
  );
};

export const MenuRadioItem = (
  props: React.ComponentProps<typeof ArkMenu.RadioItem>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkMenu.RadioItem
      className={cn(
        menuItemVariants({ variant: "default" }),
        "ps-8",
        className
      )}
      {...rest}
      data-slot={slot ?? "menu-radio-item"}
    >
      <ArkMenu.ItemIndicator className="pointer-events-none absolute inset-s-2 flex size-3.5 items-center justify-center">
        <CheckIcon />
      </ArkMenu.ItemIndicator>

      <ArkMenu.ItemText data-slot="menu-radio-item-text">
        {children}
      </ArkMenu.ItemText>
    </ArkMenu.RadioItem>
  );
};

export const MenuSub = (props: React.ComponentProps<typeof Menu>) => (
  <Menu {...props} />
);

export const MenuSubContent = (
  props: React.ComponentProps<typeof ArkMenu.Content>
) => {
  const { className, slot, ...rest } = props;

  return (
    <Portal>
      <MenuPositioner slot="menu-sub-positioner">
        <ArkMenu.Content
          className={cn(menuContentVariants(), className)}
          {...rest}
          data-slot={slot ?? "menu-sub-content"}
        />
      </MenuPositioner>
    </Portal>
  );
};

export const MenuSubTrigger = (
  props: React.ComponentProps<typeof ArkMenu.TriggerItem>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkMenu.TriggerItem
      className={cn(menuItemVariants({ variant: "default" }), className)}
      {...rest}
      data-slot={slot ?? "menu-sub-trigger"}
    >
      {children}

      <MenuShortcut>
        <ChevronRight />
      </MenuShortcut>
    </ArkMenu.TriggerItem>
  );
};

export const MenuShortcut = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      className={cn(
        "ms-auto rtl:me-auto",
        "text-muted-foreground text-xs tracking-widest",
        "group-data-highlighted/menu-item:group-data-[variant=destructive]/menu-item:text-destructive dark:group-data-highlighted/menu-item:group-data-[variant=destructive]/menu-item:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "menu-shortcut"}
    />
  );
};

// Shark's version pins `left: "20px"` *after* the caller's `style`, throwing away the offset
// the positioner computes. Dropped: this is `PopoverArrow` / `TooltipArrow` / `HoverCardArrow`
// under a fourth machine, and the three of them are what a reader compares it against.
export const MenuArrow = (
  props: React.ComponentProps<typeof ArkMenu.Arrow>
) => {
  const { style, slot, ...rest } = props;

  return (
    <ArkMenu.Arrow
      style={
        {
          "--arrow-background": "var(--popover)",
          "--arrow-size": "calc(1.5 * var(--spacing))",
          ...style,
        } as React.CSSProperties
      }
      {...rest}
      data-slot={slot ?? "menu-arrow"}
    >
      <ArkMenu.ArrowTip className="border-s border-t" />
    </ArkMenu.Arrow>
  );
};
