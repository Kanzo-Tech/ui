import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../simples/breadcrumb.js";
import { DefaultLink, type LinkComponent } from "./link.js";

/**
 * One trail entry.
 *
 * Named `BreadcrumbEntry`, not `BreadcrumbItem`: the latter is the Shark/Ark *component*
 * re-exported from `simples/breadcrumb`, and a type and a component cannot share a
 * name in the public barrel.
 */
export interface BreadcrumbEntry {
  label: ReactNode;
  /** Without `href` (or as the last entry) it renders as the current page. */
  href?: string;
  /** Leading icon for this entry. */
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbEntry[];
  /** Router link for entries that navigate. Defaults to a plain `<a>`. */
  linkComponent?: LinkComponent;
  /** Separator between entries. Defaults to a chevron. */
  separator?: ReactNode;
  className?: string;
}

/**
 * The data-driven convenience wrapper over the {@link Breadcrumb} parts: pass a trail and
 * get the landmark, the list semantics, the separators and `aria-current` on the last
 * entry. Compose the parts directly when a trail needs something unusual — an ellipsis
 * collapse, a dropdown mid-trail.
 */
export function Breadcrumbs({
  items,
  linkComponent: Link = DefaultLink,
  separator,
  className,
}: BreadcrumbsProps) {
  return (
    <Breadcrumb>
      {/* className goes on the LIST, not the nav: the list is where Shark sets `text-sm`,
          so this is the element where a consumer's size override actually resolves. */}
      <BreadcrumbList className={className}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const current = last || item.href == null;
          return (
            // The separator is a SIBLING of the item, never a child: both render as `li`,
            // and an `li` inside an `li` is invalid list markup that breaks the row count
            // screen readers announce.
            <Fragment key={`${String(item.label)}-${index}`}>
              <BreadcrumbItem>
                {item.icon != null && (
                  <span className="[&_svg]:size-3.5">{item.icon}</span>
                )}

                {current ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href as string}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!last && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
Breadcrumbs.displayName = "Breadcrumbs";
