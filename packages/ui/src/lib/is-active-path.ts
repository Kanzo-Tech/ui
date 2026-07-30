/**
 * Is `href` the active route, given the current path?
 *
 * A prefix match, but not `startsWith`: `/settings` is active on `/settings/cloud` and is **not**
 * active on `/settings-archive`. That boundary is the whole reason this is a function rather than
 * an expression written at each call site — it is four lines and it was wrong in two of them.
 *
 * The library ships no navigation component to apply it for you: a nav is a layout tree, so it is
 * hand-composed from `SidebarMenu*` and a router link through `asChild`. This is the one part of
 * that arrangement that is logic rather than markup, so it is the one part that is exported.
 */
export function isActivePath(activePath: string | undefined, href: string | undefined): boolean {
  return (
    activePath != null &&
    href != null &&
    (activePath === href || activePath.startsWith(`${href}/`))
  );
}
