import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../simples/avatar.js";
import { cn } from "../lib/cn.js";

/** The visual identity shown in a sidebar switcher trigger / menu header: an avatar (or a square
 *  icon tile, for instances/workspaces) + a label and optional description. */
export interface IdentityData {
  label: ReactNode;
  description?: ReactNode;
  /** Avatar image URL (people). */
  avatarUrl?: string;
  /** Avatar fallback (initials) when there's no image. */
  fallback?: ReactNode;
  /** A square icon tile instead of an avatar (instances / workspaces / orgs). */
  icon?: ReactNode;
}

/**
 * SidebarIdentity — the collapse-aware "avatar/icon + name + subtitle" block shared by
 * {@link SidebarUser} and {@link InstanceSwitcher}. When `responsive`, the text column and gap
 * collapse in the sidebar's icon state and the avatar grows to fill the 32px square (its
 * `data-size` grows to `md` too, so badges/icons stay correctly scaled).
 */
export function SidebarIdentity({
  data,
  responsive = false,
  collapsed = false,
}: {
  data: IdentityData;
  /** Gate the `group-data-[collapsible=icon]` variants (false for the portaled menu header). */
  responsive?: boolean;
  /** Whether the sidebar is currently collapsed (drives the avatar's semantic size). */
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 text-left",
        // Collapsed, the avatar/tile (32px) is slightly larger than the ghost button's content
        // box (32px minus its 1px transparent border), so `justify-start` would left-align it and
        // clip the right edge — reading as off-centre. Centre it so the overflow is symmetric.
        responsive && "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
      )}
    >
      {data.icon != null ? (
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground [&_svg]:size-4",
            responsive && "group-data-[collapsible=icon]:size-8",
          )}
        >
          {data.icon}
        </div>
      ) : (
        <Avatar size={responsive && collapsed ? "md" : "sm"}>
          {data.avatarUrl != null && <AvatarImage src={data.avatarUrl} alt={typeof data.label === "string" ? data.label : ""} />}
          <AvatarFallback>{data.fallback}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex min-w-0 flex-col leading-tight", responsive && "group-data-[collapsible=icon]:hidden")}>
        <span className="truncate text-sm font-medium">{data.label}</span>
        {data.description != null && <span className="truncate text-xs text-muted-foreground">{data.description}</span>}
      </div>
    </div>
  );
}
