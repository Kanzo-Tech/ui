/**
 * Open Graph needs absolute URLs. The site's own address is `NEXT_PUBLIC_SITE_URL`, the one variable
 * `build:static` sets and `llms.txt` reads; a local build falls back to the dev server.
 */
export const baseUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100");

export const siteName = "Kanzo UI";

/** The generated card for a page, addressed by the same slug the page uses. */
export const ogImageUrl = (slug: string[] = []) => `/docs-og/${[...slug, "image.png"].join("/")}`;
