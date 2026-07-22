import type { ReactNode } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar.js";
import { DefaultLink, type LinkComponent } from "./link.js";

export interface NavSection {
  heading: ReactNode;
  items: { href: string; label: ReactNode; icon?: ReactNode }[];
}

export interface SectionNavProps {
  sections: NavSection[];
  /** Router link. Defaults to a plain `<a>`. */
  linkComponent?: LinkComponent;
  /**
   * Current path — a link is active when it equals `activePath` or is a prefix of
   * it (`/x` active on `/x/y`). Keeps route-awareness in the product, not the DS.
   */
  activePath?: string;
}

/**
 * SectionNav — a grouped, headed navigation column (was keasy's `layout/section-nav.tsx`).
 * Active state is computed from the caller-supplied `activePath`, so the design system
 * stays free of `usePathname` / routing.
 */
export function SectionNav({ sections, linkComponent: Link = DefaultLink, activePath }: SectionNavProps) {
  const isActive = (href: string) =>
    activePath != null && (activePath === href || activePath.startsWith(href + "/"));
  return (
    <nav>
      {sections.map((section, i) => (
        <SidebarGroup key={i}>
          <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive(item.href)}>
                  <Link href={item.href}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
