import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{ title: "Kanzo UI" }}
      links={[
        { text: "Docs", url: "/docs" },
        { text: "Components", url: "/docs/simples/button" },
        { text: "Blocks", url: "/docs/blocks/app-shell" },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
