"use client";

import * as React from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../simples/menu.js";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./sidebar.js";
import {
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "./SidebarIdentity.js";
import { AvatarFallback, AvatarImage } from "../simples/avatar.js";
import { DefaultLink, type LinkComponent } from "./link.js";

export interface SidebarUserMenuItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Navigates via `linkComponent` when set; otherwise a plain action item. */
  href?: string;
  onSelect?: () => void;
  /** `destructive` tints the item — use it for log-out, delete-account and the like. */
  variant?: "default" | "destructive";
  /** Renders a separator above this item. */
  separatorBefore?: boolean;
}

export interface SidebarUserProps {
  user: { name: string; email?: string; avatarUrl?: string };
  /** Every entry in the dropdown (e.g. Profile, Settings, Log out). */
  menuItems?: SidebarUserMenuItem[];
  linkComponent?: LinkComponent;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * SidebarUser — avatar + name + email footer with a dropdown (was keasy's
 * `layout/nav-user.tsx`).
 *
 * Domain-free: `menuItems` is the ONLY mechanism. It used to carry a second, hard-coded one —
 * `onLogout`/`logoutLabel`/`confirmLogout` plus an AlertDialog with untranslatable English body
 * copy — which put an auth flow in a library whose own admission rule excludes auth. Log out is
 * now just an entry with `variant: "destructive"`, and the product owns its confirmation and
 * its wording.
 */
export function SidebarUser({
  user,
  menuItems = [],
  linkComponent: Link = DefaultLink,
}: SidebarUserProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  // One description of the user, rendered twice (trigger + menu header) with different
  // collapse behaviour — so it is a local element factory, not a shared node.
  const identity = (responsive: boolean) => (
    <SidebarIdentity responsive={responsive} collapsed={responsive && collapsed}>
      <SidebarIdentityAvatar>
        {user.avatarUrl != null && <AvatarImage src={user.avatarUrl} alt={user.name} />}
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
      </SidebarIdentityAvatar>
      <SidebarIdentityText>
        <SidebarIdentityLabel>{user.name}</SidebarIdentityLabel>
        {user.email != null && (
          <SidebarIdentityDescription>{user.email}</SidebarIdentityDescription>
        )}
      </SidebarIdentityText>
    </SidebarIdentity>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* Anchored like Shark's nav-user menu: beside the rail (align to its bottom) on desktop,
            below the trigger on mobile, with a 4px gutter (shadcn `sideOffset={4}`, tighter than
            Ark's default 8). */}
        <Menu positioning={{ placement: isMobile ? "bottom-end" : "right-end", gutter: 4 }}>
          <MenuTrigger asChild>
            {/* Collapsed, the button is a 32px square the avatar fills edge-to-edge; round the
                button too so its `overflow-hidden` clip matches the circular avatar (otherwise
                the avatar is clipped to the button's rounded-square and looks non-round). */}
            {/* `aria-label` only, no `tooltip`: MenuTrigger's asChild wins the single button
                node, so a nested SidebarMenuButton tooltip never binds (verified). aria-label
                still names the collapsed rail. */}
            <SidebarMenuButton
              size="lg"
              aria-label={user.name}
              className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity(true)}
              <ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </MenuTrigger>
          <MenuContent className="w-(--reference-width) min-w-56">
            <div className="px-2 py-1.5" data-slot="sidebar-user-menu-header">
              {identity(false)}
            </div>
            {menuItems.length > 0 && <MenuSeparator />}
            {menuItems.map((item, i) => (
              <React.Fragment key={i}>
                {item.separatorBefore && i > 0 && <MenuSeparator />}
                {item.href != null ? (
                  <MenuItem value={`nav-${i}`} variant={item.variant} asChild>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      {item.icon}
                      {item.label}
                    </Link>
                  </MenuItem>
                ) : (
                  <MenuItem
                    value={`act-${i}`}
                    variant={item.variant}
                    onClick={() => item.onSelect?.()}
                  >
                    {item.icon}
                    {item.label}
                  </MenuItem>
                )}
              </React.Fragment>
            ))}
          </MenuContent>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}