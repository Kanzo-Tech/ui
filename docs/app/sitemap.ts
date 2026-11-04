import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/metadata";
import { source } from "@/lib/source";

export const dynamic = "force-static";

/** Every page on disk, and the two routes outside `/docs`. Resolved against the site's own address. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = baseUrl.href.replace(/\/+$/, "");
  return ["/", "/theme-generator", ...source.getPages().map((page) => page.url)].map((path) => ({
    url: `${site}${path === "/" ? "/" : path}`,
  }));
}
