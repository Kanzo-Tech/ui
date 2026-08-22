import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{ title: "Kanzo UI" }}
      links={[
        { text: "Docs", url: "/docs" },
        { text: "Components", url: "/docs/components" },
        { text: "Blocks", url: "/docs/blocks" },
        { text: "Showcases", url: "/docs/showcases" },
      ]}
      // Same reason as `app/docs/layout.tsx`: next-themes is disabled in the root layout, so
      // fumadocs' appearance toggle called `useTheme()` into nothing and was a control that
      // changed no pixel. Appearance is the design system's — it lives on the Colour card in
      // `Preferences`, which the landing page does not mount.
      themeSwitch={{ enabled: false }}
    >
      {children}
    </HomeLayout>
  );
}
