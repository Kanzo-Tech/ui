/**
 * Open Graph needs absolute URLs, and there is no deployment yet — so the base is an env var with
 * the dev server as the fallback. Set `NEXT_PUBLIC_DOCS_URL` wherever this ends up hosted.
 *
 * It lives here rather than as `metadataBase` on the root layout because that file belongs to the
 * theme work; a per-route `metadataBase` resolves identically.
 */
export const baseUrl = new URL(process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3100");

export const siteName = "Kanzo UI";

/** The generated card for a page, addressed by the same slug the page uses. */
export const ogImageUrl = (slug: string[] = []) => `/docs-og/${[...slug, "image.png"].join("/")}`;
