import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { KanzoProvider } from "@/components/kanzo-provider";
import "@kanzo-tech/ui/styles.css";
import "./global.css";

export const metadata = {
  title: "Kanzo UI",
  description: "Ark UI + tailwind-variants primitives over design tokens.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <KanzoProvider>{children}</KanzoProvider>
        </RootProvider>
      </body>
    </html>
  );
}
