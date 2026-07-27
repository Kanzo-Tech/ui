import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../simples/breadcrumb.js";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../simples/menu.js";
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
  /**
   * How many entries stay visible before the middle collapses into a menu. Off by default.
   *
   * The first entry and the last `maxItems - 1` survive; everything between them moves into the
   * menu behind the ellipsis, so a collapsed entry is still reachable rather than merely hidden.
   * Values below 2 are ignored — a trail needs a root and a leaf to be a trail.
   */
  maxItems?: number;
  /** Accessible name for the ellipsis trigger. */
  collapsedLabel?: string;
  className?: string;
}

/**
 * The data-driven convenience wrapper over the {@link Breadcrumb} parts: pass a trail and
 * get the landmark, the list semantics, the separators, `aria-current` on the last entry,
 * and — with `maxItems` — the collapse. Compose the parts directly when a trail needs
 * something the props do not cover.
 *
 * On narrow widths the list wraps onto a second line. That is Shark's behaviour and it is
 * deliberate upstream (`flex-wrap` on the list, `text-nowrap` on the link, so labels never
 * break mid-word), so it is not something to "fix" in the primitive. `maxItems` is the way
 * out, and it is the same way out Shark documents — its own narrow-width examples collapse
 * the trail by hand; this does it from the data.
 */
export function Breadcrumbs({
  items,
  linkComponent: Link = DefaultLink,
  separator,
  maxItems,
  collapsedLabel = "Show the rest of the trail",
  className,
}: BreadcrumbsProps) {
  const collapsed = maxItems != null && maxItems >= 2 && items.length > maxItems;
  const keepFromEnd = collapsed ? (maxItems as number) - 1 : 0;
  const hidden = collapsed ? items.slice(1, items.length - keepFromEnd) : [];

  /** One entry, as its `li`. `index` is the position in the ORIGINAL trail, not the rendered one. */
  const entry = (item: BreadcrumbEntry, index: number) => {
    const current = index === items.length - 1 || item.href == null;
    return (
      <BreadcrumbItem>
        {item.icon != null && <span className="[&_svg]:size-3.5">{item.icon}</span>}

        {current ? (
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={item.href as string}>{item.label}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
    );
  };

  // The rendered sequence, flattened first so the separators can be interleaved without caring
  // whether a slot is an entry or the ellipsis.
  const slots: { key: string; node: ReactNode }[] = collapsed
    ? [
        { key: "0", node: entry(items[0] as BreadcrumbEntry, 0) },
        {
          key: "collapsed",
          node: (
            <BreadcrumbItem>
              <Menu>
                {/* The label lives on the button because `BreadcrumbEllipsis` is `aria-hidden`
                    — it is decoration, and decoration cannot name its own control. */}
                <MenuTrigger asChild>
                  <Button aria-label={collapsedLabel} size="icon-sm" variant="ghost">
                    <BreadcrumbEllipsis />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {hidden.map((item, i) => (
                    <MenuItem key={`${String(item.label)}-${i}`} value={`crumb-${i}`} asChild>
                      {item.href != null ? (
                        <Link href={item.href}>{item.label}</Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            </BreadcrumbItem>
          ),
        },
        ...items.slice(items.length - keepFromEnd).map((item, i) => {
          const index = items.length - keepFromEnd + i;
          return { key: String(index), node: entry(item, index) };
        }),
      ]
    : items.map((item, index) => ({ key: String(index), node: entry(item, index) }));

  return (
    // `min-w-0` on the landmark, which upstream leaves classless. Inside a flex row — a shell
    // header, a toolbar — a `nav` without it refuses to shrink below its content, so the trail
    // stops yielding and pushes whatever sits beside it off the edge instead. Additive, and never
    // worse: a landmark that *can* shrink still only shrinks when the row is short of room.
    <Breadcrumb className="min-w-0">
      {/* className goes on the LIST, not the nav: the list is where Shark sets `text-sm`,
          so this is the element where a consumer's size override actually resolves. */}
      <BreadcrumbList className={className}>
        {slots.map((slot, index) => (
          // The separator is a SIBLING of the item, never a child: both render as `li`,
          // and an `li` inside an `li` is invalid list markup that breaks the row count
          // screen readers announce.
          <Fragment key={slot.key}>
            {slot.node}
            {index < slots.length - 1 && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
Breadcrumbs.displayName = "Breadcrumbs";
