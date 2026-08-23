import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { HomeContainer } from "@/components/home-container";
import { baseOptions, THEMES_LINK } from "@/lib/layout.config";

/**
 * The chrome for everything outside `/docs`: the landing page and the theme generator.
 *
 * The container slot is overridden so this layout stops rendering a `<main>` of its own — see
 * `HomeContainer`, which also carries why it has to be a client module.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      {...baseOptions}
      links={[
        { text: "Docs", url: "/docs" },
        { text: "Components", url: "/docs/components" },
        { text: "Blocks", url: "/docs/blocks" },
        THEMES_LINK,
        { text: "Showcases", url: "/docs/showcases" },
      ]}
      slots={{ ...baseOptions.slots, container: HomeContainer }}
    >
      {children}
    </HomeLayout>
  );
}
