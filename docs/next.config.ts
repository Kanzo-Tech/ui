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
