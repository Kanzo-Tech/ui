"use client";

import type { ComponentProps, ComponentType } from "react";
import { ToggleGroup, ToggleGroupItem } from "../simples/toggle-group.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";

export interface ShellDockSwitcherProps
  extends Omit<ComponentProps<typeof ToggleGroup>, "value" | "defaultValue" | "onValueChange" | "multiple"> {
  /** The open panel's `value`, or `null` while the dock is collapsed. */
  value: string | null;
  /** Called with the item pressed, or with `null` when the open one is pressed again. */
  onValueChange: (value: string | null) => void;
}

/**
 * **Which panel the dock holds** — VS Code's activity bar: an icon per panel, one pressed while its
 * panel is open, and pressing it again collapses the dock, a state `Tabs` cannot express. It is a
 * single-select `ToggleGroup`, so its roles, roving focus and checked state are Ark's. Put it in
 * whichever region the page keeps it, a `ShellFooter` or a vertical strip beside the dock.
 */
export function ShellDockSwitcher(props: ShellDockSwitcherProps) {
  const { value, onValueChange, size = "sm", spacing = 2, slot, ...rest } = props;
  return (
    <ToggleGroup
      aria-label="Panels"
      onValueChange={(details) => onValueChange(details.value[0] ?? null)}
      size={size}
      spacing={spacing}
      value={value === null ? [] : [value]}
      {...rest}
      multiple={false}
      slot={slot ?? "shell-dock-switcher"}
    />
  );
}

export interface ShellDockItemProps extends Omit<ComponentProps<typeof ToggleGroupItem>, "children" | "aria-label"> {
  value: string;
  /** The panel's name: the item's tooltip and its accessible name. */
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * One panel's icon in a `ShellDockSwitcher`, named by `label`; the panel's own title says it in
 * words. The item is the outer part and the tooltip trigger its child: in an `asChild` chain the
 * outer props win, and zag collects a group's items by `[data-scope=toggle-group][data-part=item]`,
 * so the other nesting leaves the group with no items and no roving focus, silently.
 */
export function ShellDockItem(props: ShellDockItemProps) {
  const { label, icon: Icon, slot, ...rest } = props;
  return (
    <Tooltip>
      <ToggleGroupItem aria-label={label} asChild {...rest}>
        <TooltipTrigger slot={slot ?? "shell-dock-item"}>
          <Icon />
        </TooltipTrigger>
      </ToggleGroupItem>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
