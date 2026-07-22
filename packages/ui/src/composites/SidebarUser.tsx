"use client";

import * as React from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../simples/menu.js";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../simples/sidebar.js";
import { SidebarIdentity, type IdentityData } from "./SidebarIdentity.js";
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

  const identity: IdentityData = {
    label: user.name,
    description: user.email,
    avatarUrl: user.avatarUrl,
    fallback: initials(user.name),
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu positioning={{ placement: isMobile ? "bottom" : "right-end" }}>
          <MenuTrigger asChild>
            {/* Collapsed, the button is a 32px square the avatar fills edge-to-edge; round the
                button too so its `overflow-hidden` clip matches the circular avatar (otherwise
                the avatar is clipped to the button's rounded-square and looks non-round). */}
            <SidebarMenuButton
              size="lg"
              className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
            >
              <SidebarIdentity data={identity} responsive collapsed={collapsed} />
              <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </MenuTrigger>
          <MenuContent className="w-(--reference-width) min-w-56">
            <div className="px-2 py-1.5">
              <SidebarIdentity data={identity} />
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