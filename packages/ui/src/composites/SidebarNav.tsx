import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../simples/collapsible.js";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroupLabel,
  useSidebar,
} from "./sidebar.js";
import { DefaultLink, type LinkComponent } from "./link.js";

/** A navigation entry: either a leaf (has `href`) or a group with `items`. */
export interface SidebarNavItem {
  title: string;
  href?: string;
  /** Pre-rendered icon (icon-library agnostic — the DS never imports lucide). */
  icon?: React.ReactNode;
  isActive?: boolean;
  items?: { title: string; href: string; isActive?: boolean }[];
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  /** Group heading (was hardcoded "Platform"). Omit for no label. */
  label?: React.ReactNode;
  /** Router link. Defaults to a plain `<a>`. */
  linkComponent?: LinkComponent;
}

/**
 * SidebarNav — the primary nav list with collapsible sub-items (was keasy's
 * `layout/nav-main.tsx`). Domain-free: `label` is a prop, navigation goes through
 * the injected `linkComponent`, and the mobile drawer closes itself on navigate.
 */
export function SidebarNav({ items, label, linkComponent: Link = DefaultLink }: SidebarNavProps) {
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  return (
    <nav aria-label={typeof label === "string" ? label : "Sidebar"} data-slot="sidebar-nav">
    <SidebarGroup>
      {label != null && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) =>
          item.items?.length ? (
            <CollapsibleItem key={item.title} item={item} Link={Link} onNavigate={close} />
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title}>
                <Link href={item.href ?? "#"} onClick={close}>
                  {item.icon}
                  <span>{item.title}</span>
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

function CollapsibleItem({ item, Link, onNavigate }: { item: SidebarNavItem; Link: LinkComponent; onNavigate: () => void }) {
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen={Boolean(item.isActive)}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} className="[&[data-state=open]>svg:last-child]:rotate-90">
            {item.icon}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto shrink-0 transition-transform duration-200" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items!.map((sub) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton asChild isActive={sub.isActive}>
                  <Link href={sub.href} onClick={onNavigate}>
                    <span>{sub.title}</span>
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
