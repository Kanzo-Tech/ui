"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "../simples/menu.js";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./sidebar.js";
import {
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "./SidebarIdentity.js";
import { AvatarFallback, AvatarImage } from "../simples/avatar.js";
import { cn } from "../lib/cn.js";
import { DefaultLink, type LinkComponent } from "./link.js";

/** A switchable instance / workspace / organisation. */
export interface Instance {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Square icon tile (falls back to initials from `label` when absent). */
  icon?: React.ReactNode;
  avatarUrl?: string;
}

/** An extra action below the instance list (e.g. "Create workspace", "Manage"). */
export interface InstanceSwitcherAction {
  label: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
}

export interface InstanceSwitcherProps {
  instances: Instance[];
  activeId: string;
  onSelect?: (id: string) => void;
  /** Heading above the instance list. */
  label?: React.ReactNode;
  /** Extra actions below the list. */
  actions?: InstanceSwitcherAction[];
  linkComponent?: LinkComponent;
}

/** Renders one instance as a {@link SidebarIdentity}: an icon tile when it has one, else an
 *  avatar falling back to initials from a string label. */
function Identity({
  inst,
  responsive = false,
  collapsed = false,
}: {
  inst: Instance;
  responsive?: boolean;
  collapsed?: boolean;
}) {
  return (
    <SidebarIdentity responsive={responsive} collapsed={collapsed}>
      {inst.icon != null ? (
        <SidebarIdentityIcon>{inst.icon}</SidebarIdentityIcon>
      ) : (
        <SidebarIdentityAvatar>
          {inst.avatarUrl != null && (
            <AvatarImage src={inst.avatarUrl} alt={typeof inst.label === "string" ? inst.label : ""} />
          )}
          <AvatarFallback>
            {typeof inst.label === "string" ? inst.label.slice(0, 2).toUpperCase() : undefined}
          </AvatarFallback>
        </SidebarIdentityAvatar>
      )}
      <SidebarIdentityText>
        <SidebarIdentityLabel>{inst.label}</SidebarIdentityLabel>
        {inst.description != null && (
          <SidebarIdentityDescription>{inst.description}</SidebarIdentityDescription>
        )}
      </SidebarIdentityText>
    </SidebarIdentity>
  );
}

/**
 * InstanceSwitcher — the sidebar control for switching between instances / workspaces / orgs
 * (keasy's instance switcher, generalised). Shares the collapse-aware {@link SidebarIdentity}
 * trigger with {@link SidebarUser}. Domain-free: instances, the active id, and actions are props.
 */
export function InstanceSwitcher({
  instances,
  activeId,
  onSelect,
  label,
  actions = [],
  linkComponent: Link = DefaultLink,
}: InstanceSwitcherProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const active = instances.find((i) => i.id === activeId) ?? instances[0];
  const activeLabel = active != null && typeof active.label === "string" ? active.label : undefined;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* Anchored like Shark's team switcher: beside the rail (align to its top) on desktop,
            below the trigger on mobile, with a 4px gutter (shadcn `sideOffset={4}`, tighter than
            Ark's default 8). */}
        <Menu
          positioning={{ placement: isMobile ? "bottom-start" : "right-start", gutter: 4 }}
        >
          <MenuTrigger asChild>
            {/* Round the collapsed button to match a circular avatar so its clip doesn't square
                it off; a square icon tile keeps the default rounding. */}
            {/* `aria-label` only, no `tooltip`: MenuTrigger's asChild wins the single button
                node, so a nested SidebarMenuButton tooltip never binds its trigger (verified —
                the button carries the menu scope, never a tooltip one). aria-label still gives
                the collapsed rail an accessible name. */}
            <SidebarMenuButton
              size="lg"
              aria-label={activeLabel}
              className={cn(
                "group-data-[collapsible=icon]:justify-center",
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                active != null && active.icon == null && "group-data-[collapsible=icon]:rounded-full",
              )}
            >
              {active != null && <Identity inst={active} responsive collapsed={collapsed} />}
              <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </MenuTrigger>
          {/* `w-(--reference-width)` matches the trigger width (Ark exposes it on the positioner),
              so the menu reads as anchored to the button instead of floating beside the rail.
              Same as Shark's sidebar block. */}
          <MenuContent className="w-(--reference-width) min-w-60">
            {/* MenuGroup renders the ItemGroup ancestor MenuGroupLabel requires, so the
                heading is associated with the instances for assistive tech. */}
            <MenuGroup heading={typeof label === "string" ? label : undefined}>
              {label != null && typeof label !== "string" && (
                <MenuGroupLabel>{label}</MenuGroupLabel>
              )}
              {instances.map((inst) => (
                <MenuItem
                  key={inst.id}
                  value={inst.id}
                  onClick={() => {
                    onSelect?.(inst.id);
                    setOpenMobile(false);
                  }}
                >
                  <Identity inst={inst} />
                  {inst.id === activeId && <CheckIcon className="ml-auto" />}
                </MenuItem>
              ))}
            </MenuGroup>
            {actions.length > 0 && <MenuSeparator />}
            {actions.map((action, i) =>
              action.href != null ? (
                <MenuItem key={i} value={`act-${i}`} asChild>
                  <Link href={action.href} onClick={() => setOpenMobile(false)}>
                    {action.icon}
                    {action.label}
                  </Link>
                </MenuItem>
              ) : (
                <MenuItem key={i} value={`act-${i}`} onClick={() => action.onSelect?.()}>
                  {action.icon}
                  {action.label}
                </MenuItem>
              ),
            )}
          </MenuContent>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
