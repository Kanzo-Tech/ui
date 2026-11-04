"use client";

import { Fragment, type ReactNode } from "react";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  cn,
  Float,
  Separator,
  ShellHeader,
  Show,
  SidebarTrigger,
  toast,
} from "@kanzo-tech/ui";
import { BellIcon } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { ROUTES } from "./data";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Every screen's header: the rail's trigger, the trail from Dashboard, and the screen's own
 * controls at the end, before the search and the notifications every screen shares.
 */
export function ScreenHeader({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  const trail: Crumb[] = [{ label: "Dashboard", href: ROUTES.dashboard }, ...crumbs];

  return (
    <ShellHeader className="h-12 min-w-0 flex-row items-center gap-2 px-3">
      <SidebarTrigger />
      <Separator className="h-4" orientation="vertical" />

      {/* A fixed-height strip has no second row, so the list does not wrap: the trail yields and
          its leaf truncates, because it is the part you can still infer from the page. */}
      <Breadcrumb>
        <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
          {trail.map((crumb, index) => (
            // A separator is a SIBLING of the item: both render an `li`.
            // A phone keeps the parent and the leaf: the parent is the way back.
            <Fragment key={crumb.label}>
              <Show when={index > 0}>
                <BreadcrumbSeparator className={cn(index < trail.length - 1 && "max-sm:hidden")} />
              </Show>
              <Show
                fallback={
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                }
                when={index < trail.length - 1}
              >
                <BreadcrumbItem className={cn(index < trail.length - 2 && "max-sm:hidden")}>
                  <BreadcrumbLink asChild>
                    <a href={crumb.href}>{crumb.label}</a>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Show>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ms-auto flex items-center gap-1.5">
        {children}
        <CommandPalette />
        <div className="relative">
          <Button
            aria-label="Notifications"
            onClick={() => toast.create({ title: "3 new notifications", type: "info" })}
            size="icon-sm"
            variant="ghost"
          >
            <BellIcon />
          </Button>
          <Float className="-end-0.5 -top-0.5" placement="top-end">
            <Badge className="rounded-full" size="xs" variant="destructive">
              3
            </Badge>
          </Float>
        </div>
      </div>
    </ShellHeader>
  );
}
