// The preference half of the sidebar, kept out of `sidebar.tsx` because that module is a client
// module: a Server Component importing a constant from it receives a client reference, not a
// string, so a layout could neither name the cookie nor parse it.

/** The cookie `SidebarProvider` writes the person's open-or-collapsed preference to. */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";

/**
 * Turns the raw `sidebar_state` cookie value into `SidebarProvider`'s `defaultOpen`. Absent or
 * unreadable reads as open, the provider's own default, so a first visit looks like no cookie at
 * all.
 *
 * @example
 * const defaultOpen = parseSidebarCookie((await cookies()).get(SIDEBAR_COOKIE_NAME)?.value);
 */
export const parseSidebarCookie = (value: string | null | undefined): boolean => value !== "false";
