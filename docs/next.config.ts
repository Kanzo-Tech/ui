import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,
  // The design system is consumed from source here so a change shows up without a rebuild,
  // and — more importantly — so this app exercises the REAL client/server boundary of the
  // library. Vite ignores "use client" entirely, which is why the stripped-directive bug
  // survived every hour spent in the old playground.
  transpilePackages: ["@kanzo-tech/ui", "@kanzo-tech/theme"],
};

export default withMDX(config);
