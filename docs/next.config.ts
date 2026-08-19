import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,
  // The design system is consumed from source here so a change shows up without a rebuild,
  // and — more importantly — so this app exercises the REAL client/server boundary of the
  // library. Vite ignores "use client" entirely, which is why the stripped-directive bug
  // survived every hour spent in the old playground.
  transpilePackages: ["@kanzo-tech/ui", "@kanzo-tech/theme", "@kanzo-tech/palette"],
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
  // `/docs/actions/button.mdx` serves that page's Markdown source. Rewrites run before dynamic
  // routes, so the suffixed URL never reaches the `[[...slug]]` page.
  async rewrites() {
    return [
      { source: "/docs.mdx", destination: "/llms.mdx/docs" },
      { source: "/docs/:path*.mdx", destination: "/llms.mdx/docs/:path*" },
    ];
  },
};

export default withMDX(config);
