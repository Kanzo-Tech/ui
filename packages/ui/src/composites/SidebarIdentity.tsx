"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { Avatar } from "../simples/avatar.js";
import { cn } from "../lib/cn.js";

/**
 * `responsive`/`collapsed` are behaviour, so they stay props on the root — but the parts need
 * them too (the avatar's semantic size, the text column's collapse). Context carries them
 * down instead of the caller repeating them on every part. This context is why the file is
 * `"use client"`.
 */
const IdentityCtx = createContext<{ responsive: boolean; collapsed: boolean }>({
  responsive: false,
  collapsed: false,
});

export interface SidebarIdentityProps extends ComponentProps<"div"> {
  /** Gate the `group-data-[collapsible=icon]` variants (false for the portaled menu header). */
  responsive?: boolean;
  /** Whether the sidebar is currently collapsed (drives the avatar's semantic size). */
  collapsed?: boolean;
}

/**
 * SidebarIdentity — the collapse-aware "avatar/icon + name + subtitle" block a sidebar header or
 * footer is built from. When `responsive`, the text column and gap
 * collapse in the sidebar's icon state and the avatar grows to fill the 32px square (its
 * `data-size` grows to `md` too, so badges/icons stay correctly scaled).
 *
 * The content is CHILDREN, not an `IdentityData` object prop. A record of `ReactNode`s
 * (`label`/`description`/`avatarUrl`/`fallback`/`icon`) is a layout tree written as an
 * attribute: you cannot reorder it, wrap a region, spread props onto one, or use `asChild` —
 * and the avatar could only ever be an `<img src>` plus initials, never a badge or a status
 * dot. Composition gives all of that back, and matches how every simple in this library
 * already works — `CardHeader`, not `<Card header={…} />`.
 *
 *   <SidebarIdentity responsive collapsed={collapsed}>
 *     <SidebarIdentityAvatar>
 *       <AvatarImage src={url} alt={name} />
 *       <AvatarFallback>{initials}</AvatarFallback>
 *     </SidebarIdentityAvatar>
 *     <SidebarIdentityText>
 *       <SidebarIdentityLabel>{name}</SidebarIdentityLabel>
 *       <SidebarIdentityDescription>{email}</SidebarIdentityDescription>
 *     </SidebarIdentityText>
 *   </SidebarIdentity>
 */
export function SidebarIdentity({
  responsive = false,
  collapsed = false,
  className,
  children,
  slot,
  ...rest
}: SidebarIdentityProps) {
  return (
    <IdentityCtx.Provider value={{ responsive, collapsed }}>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-start",
          // Collapsed, the avatar/tile (32px) is slightly larger than the ghost button's content
          // box (32px minus its 1px transparent border), so `justify-start` would left-align it and
          // clip the right edge — reading as off-centre. Centre it so the overflow is symmetric.
          responsive && "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
          className,
        )}
        {...rest}
        data-slot={slot ?? "sidebar-identity"}
      >
        {children}
      </div>
    </IdentityCtx.Provider>
  );
}
SidebarIdentity.displayName = "SidebarIdentity";

/** A square icon tile instead of an avatar (instances / workspaces / orgs). */
export function SidebarIdentityIcon({ className, slot, ...rest }: ComponentProps<"div">) {
  const { responsive } = useContext(IdentityCtx);
  return (
    <div
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground [&_svg]:size-4",
        responsive && "group-data-[collapsible=icon]:size-8",
        className,
      )}
      {...rest}
      data-slot={slot ?? "sidebar-identity-icon"}
    />
  );
}
SidebarIdentityIcon.displayName = "SidebarIdentityIcon";

/**
 * The avatar (people). Takes `AvatarImage` / `AvatarFallback` as children; its `size` is
 * derived from the sidebar state, so it is not overridable here.
 */
export function SidebarIdentityAvatar({ slot, ...rest }: Omit<ComponentProps<typeof Avatar>, "size">) {
  const { responsive, collapsed } = useContext(IdentityCtx);
  return <Avatar size={responsive && collapsed ? "md" : "sm"} {...rest} slot={slot ?? "sidebar-identity-avatar"} />;
}
SidebarIdentityAvatar.displayName = "SidebarIdentityAvatar";

/** The text column. Hidden entirely in the sidebar's icon state when `responsive`. */
export function SidebarIdentityText({ className, slot, ...rest }: ComponentProps<"div">) {
  const { responsive } = useContext(IdentityCtx);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col leading-tight",
        responsive && "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...rest}
      data-slot={slot ?? "sidebar-identity-text"}
    />
  );
}
SidebarIdentityText.displayName = "SidebarIdentityText";

export function SidebarIdentityLabel({ className, slot, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cn("truncate text-sm font-medium", className)}
      {...rest}
      data-slot={slot ?? "sidebar-identity-label"}
    />
  );
}
SidebarIdentityLabel.displayName = "SidebarIdentityLabel";

export function SidebarIdentityDescription({ className, slot, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cn("truncate text-xs text-muted-foreground", className)}
      {...rest}
      data-slot={slot ?? "sidebar-identity-description"}
    />
  );
}
SidebarIdentityDescription.displayName = "SidebarIdentityDescription";
