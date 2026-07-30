import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Show,
} from "@kanzo-tech/ui";

const TRAIL: { label: string; href?: string }[] = [
  { label: "Kanzo", href: "#" },
  { label: "Connections", href: "#" },
  { label: "aemet", href: "#" },
  { label: "Datasets", href: "#" },
  { label: "customers" },
];

// Keep the first crumb and the last two; everything between goes behind the ellipsis. A trail
// needs a root and a leaf, so there is no useful collapse below two kept crumbs.
const [root, ...rest] = TRAIL;
const tail = rest.slice(-2);
const hidden = rest.slice(0, -2);

export default function Example() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={root?.href}>{root?.label}</BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <Menu>
            {/* The accessible name goes on the Button. `BreadcrumbEllipsis` is `aria-hidden`
                decoration, and decoration cannot name its own control. */}
            <MenuTrigger asChild>
              <Button aria-label="Show the rest of the trail" size="icon-sm" variant="ghost">
                <BreadcrumbEllipsis />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {hidden.map((item) => (
                <MenuItem asChild key={item.label} value={item.label}>
                  <a href={item.href}>{item.label}</a>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </BreadcrumbItem>

        {/* A separator is a SIBLING of the item it precedes, never a child: both render `li`,
            and an `li` inside an `li` breaks the count screen readers announce. */}
        {tail.map((item, i) => (
          <Fragment key={item.label}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Show
                fallback={<BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>}
                when={i === tail.length - 1}
              >
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              </Show>
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
