import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

/**
 * Empty in development, `/ui` on GitHub Pages — one variable, read here AND by the client.
 *
 * A project page is served from `<org>.github.io/<repo>`, so every URL the app emits needs that
 * prefix. Next rewrites the ones it owns (`Link`, `next/image`, `_next/*`); it cannot rewrite a
 * string handed to `fetch` or to DuckDB, and `showcases/workspace/graph-state.tsx` reads this same
 * variable for exactly that reason. Two spellings of the prefix would drift the first time one
 * moved, which is why this is not typed twice.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * **The export is opt-in, and that is not timidity — it is what keeps the measuring rig alive.**
 *
 * `output: "export"` removes `next start`, and `scripts/measure-previews.mjs` drives a running
 * server: `pnpm check:previews` is the guard that caught seven clipped preview frames and it would
 * simply have no server to point at. So the default build stays exactly what it was, and CI sets
 * `DOCS_STATIC_EXPORT=1` for the artefact it publishes.
 *
 * The cost is honest and worth naming: the thing that ships is then not the thing the local chain
 * builds. `pnpm --filter @kanzo-tech/docs build:static` exists so that difference is one command
 * away rather than only reachable through a workflow file.
 */
const staticExport = process.env.DOCS_STATIC_EXPORT === "1";

const config: NextConfig = {
  reactStrictMode: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  /** The optimiser is a server. Nothing here ships a raster asset that wanted one. */
  images: { unoptimized: true },
  ...(staticExport
    ? {
        /**
         * **A static export, because Pages runs nothing.** Every page and every route handler is
         * emitted as a file at build time and served by a CDN that cannot execute code.
         *
         * Three things in this app had to move for it, and each is answered where it lives rather
         * than disabled: `api/search` emits its index instead of answering queries (`staticGET`),
         * the two `.mdx` source routes already carried `generateStaticParams`, and `rewrites()` is
         * gone — see below.
         */
        output: "export" as const,
        /**
         * Directories, not `page.html` — `out/docs/actions/button/index.html`, so a CDN with no
         * rewrite rules serves `/docs/actions/button` without a redirect and without a
         * trailing-slash fight.
         */
        trailingSlash: true,
      }
    : {}),
  // The design system is consumed from source here so a change shows up without a rebuild,
  // and — more importantly — so this app exercises the REAL client/server boundary of the
  // library. Vite ignores "use client" entirely, which is why the stripped-directive bug
  // survived every hour spent in the old playground.
  transpilePackages: ["@kanzo-tech/ui", "@kanzo-tech/theme"],
  /**
   * The one thing the browser build needs that the browser never runs.
   *
   * `showcases/field-notes/live.ts` calls the model from the client with the visitor's own key, so
   * `@anthropic-ai/sdk` is in the browser bundle. Its credential chain reaches for the machine's
   * own credentials — `await import("node:fs")` and friends — inside branches that only execute on
   * a server. Webpack resolves a dynamic import statically all the same, and a `node:` scheme in a
   * web target is `UnhandledSchemeError`: the whole page fails to compile over code that cannot
   * run. Stripping the scheme and resolving what is left to `false` makes those branches empty
   * modules; the key is passed to the client explicitly, so nothing here is ever reached.
   *
   * Client only. The server build keeps the real modules, which is what the docs' own route
   * handlers and the MDX pipeline are built on.
   */
  webpack(config, { isServer, webpack }) {
    if (isServer) return config;
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: false,
      crypto: false,
      fs: false,
      "fs/promises": false,
      path: false,
      readline: false,
      stream: false,
      "stream/promises": false,
      util: false,
    };
    return config;
  },
  /**
   * `/docs/actions/button.mdx` serves that page's Markdown source. Rewrites run before dynamic
   * routes, so the suffixed URL never reaches the `[[...slug]]` page.
   *
   * **A static export has nowhere to run this**, and Next refuses the key outright there. The
   * addresses do not change: `scripts/materialise-mdx.mjs` writes the same files at the same URLs
   * after the export, so the two builds serve the same thing by different means — a rewrite on a
   * server, a file on a CDN. The rewrite was never load-bearing for anything but the address; the
   * route it points at already carries `generateStaticParams`, so the content was static all along
   * and only the door was dynamic.
   */
  ...(staticExport
    ? {}
    : {
        async rewrites() {
          return [
            { source: "/docs.mdx", destination: "/llms.mdx/docs-index" },
            { source: "/docs/:path*.mdx", destination: "/llms.mdx/docs/:path*.mdx" },
          ];
        },
      }),
};

export default withMDX(config);
