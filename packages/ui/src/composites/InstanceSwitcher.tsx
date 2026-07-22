"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../primitives/menu.js";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../primitives/sidebar.js";
import { SidebarIdentity, type IdentityData } from "./SidebarIdentity.js";
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

function toIdentity(inst: Instance): IdentityData {
  return {
    label: inst.label,
    description: inst.description,
    avatarUrl: inst.avatarUrl,
    icon: inst.icon,
    fallback: typeof inst.label === "string" ? inst.label.slice(0, 2).toUpperCase() : undefined,
  };
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu positioning={{ placement: isMobile ? "bottom" : "right-start" }}>
          <MenuTrigger asChild>
            {/* Round the collapsed button to match a circular avatar so its clip doesn't square
                it off; a square icon tile keeps the default rounding. */}
            <SidebarMenuButton
              size="lg"
              className={cn(
                "group-data-[collapsible=icon]:justify-center",
                active != null && active.icon == null && "group-data-[collapsible=icon]:rounded-full",
              )}
            >
              {active != null && <SidebarIdentity data={toIdentity(active)} responsive collapsed={collapsed} />}
              <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </MenuTrigger>
          {/* `w-(--reference-width)` matches the trigger width (Ark exposes it on the positioner),
              so the menu reads as anchored to the button instead of floating beside the rail.
              Same as Shark's sidebar block. */}
          <MenuContent className="w-(--reference-width) min-w-60">
            {/* A plain label, NOT MenuGroupLabel: Ark's ItemGroupLabel requires an
                ItemGroup ancestor and throws without one — which crashes the whole menu on
                open. Only use MenuGroupLabel inside <MenuGroup>. */}
            {label != null && (
              <div className="px-2 py-1.5 text-muted-foreground text-xs">{label}</div>
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
                <SidebarIdentity data={toIdentity(inst)} />
                {inst.id === activeId && <CheckIcon className="ml-auto" />}
              </MenuItem>
            ))}
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
