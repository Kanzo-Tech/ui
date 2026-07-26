import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../simples/collapsible.js";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroupLabel,
  useSidebar,
} from "./sidebar.js";
import { DefaultLink, type LinkComponent } from "./link.js";

/** A sub-entry of a collapsible group. Always a leaf. */
export interface SidebarNavSubItem {
  title: string;
  href: string;
  isActive?: boolean;
  /** Trailing count/status ("3", "beta"). Rendered inside the row, so it never covers the title. */
  badge?: React.ReactNode;
}

/** A navigation entry: either a leaf (has `href`) or a group with `items`. */
export interface SidebarNavItem {
  title: string;
  href?: string;
  /** Pre-rendered icon (icon-library agnostic — the DS never imports lucide). */
  icon?: React.ReactNode;
  isActive?: boolean;
  /** Trailing count/status ("3", "beta"). Rendered inside the row, so it never covers the title. */
  badge?: React.ReactNode;
  items?: SidebarNavSubItem[];
}

/**
 * `placement="inline"` throughout: every row here ends in either a chevron (groups) or a
 * truncating title, and the default overlay badge would sit on top of both.
 */
const NavBadge = ({ children }: { children: React.ReactNode }) => (
  <SidebarMenuBadge asChild placement="inline">
    <span>{children}</span>
  </SidebarMenuBadge>
);

export interface SidebarNavProps {
  items: SidebarNavItem[];
  /** Group heading, and the accessible name of the `<nav>` when it is a string. Omit for no label. */
  label?: React.ReactNode;
  /** Router link. Defaults to a plain `<a>`. */
  linkComponent?: LinkComponent;
  /**
   * Current path — the second way to say which row is lit. An entry with no explicit
   * `isActive` is active when its `href` equals `activePath` or is a prefix of it
   * (`/x` stays lit on `/x/y`). Keeps route-awareness in the product, not the DS.
   */
  activePath?: string;
}

/** `/settings` is active on `/settings/cloud`; it is not active on `/settings-archive`. */
const matchesPath = (activePath: string | undefined, href: string | undefined) =>
  activePath != null &&
  href != null &&
  (activePath === href || activePath.startsWith(`${href}/`));

type Activatable = Pick<SidebarNavItem, "href" | "isActive">;

/**
 * SidebarNav — the navigation column, with collapsible sub-items (was keasy's
 * `layout/nav-main.tsx`, merged with its near-twin `SectionNav`). Domain-free: `label` is a
 * prop, navigation goes through the injected `linkComponent`, and the mobile drawer closes
 * itself on navigate.
 *
 * Two ways to say what is active, and they compose: per-item `isActive` when the caller
 * already holds the answer, or one `activePath` the component prefix-matches. An explicit
 * `isActive` always wins — including `isActive: false`, which is how you veto a match.
 *
 * Several *titled* groups are several of these, one per heading — which is what
 * `docs/showcases/app-shell/default.tsx` does. Each then names its own `<nav>` landmark.
 */
export function SidebarNav({
  items,
  label,
  linkComponent: Link = DefaultLink,
  activePath,
}: SidebarNavProps) {
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  const isActive = (item: Activatable) => item.isActive ?? matchesPath(activePath, item.href);
  return (
    <nav aria-label={typeof label === "string" ? label : "Sidebar"} data-slot="sidebar-nav">
    <SidebarGroup>
      {label != null && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) =>
          item.items?.length ? (
            <CollapsibleItem
              key={item.title}
              item={item}
              Link={Link}
              onNavigate={close}
              isActive={isActive}
            />
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
                <Link href={item.href ?? "#"} onClick={close}>
                  {item.icon}
                  <span className="truncate">{item.title}</span>
                  {item.badge != null && <NavBadge>{item.badge}</NavBadge>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
    </nav>
  );
}

function CollapsibleItem({
  item,
  Link,
  onNavigate,
  isActive,
}: {
  item: SidebarNavItem;
  Link: LinkComponent;
  onNavigate: () => void;
  isActive: (item: Activatable) => boolean;
}) {
  // Open when the group is active OR anything under it is: a closed group hides its own
  // active row, which is the one thing the caller asked to show.
  const defaultOpen = isActive(item) || item.items!.some(isActive);
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} className="[&[data-state=open]>svg:last-child]:rotate-90">
            {item.icon}
            <span className="truncate">{item.title}</span>
            {item.badge != null && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight
              className={cn("shrink-0 transition-transform duration-200", item.badge == null && "ms-auto")}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items!.map((sub) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton asChild isActive={isActive(sub)}>
                  <Link href={sub.href} onClick={onNavigate}>
                    <span className="truncate">{sub.title}</span>
                    {sub.badge != null && <NavBadge>{sub.badge}</NavBadge>}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
