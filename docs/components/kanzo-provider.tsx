"use client";

import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { KanzoThemeProvider } from "@kanzo-tech/ui";

/**
 * Hands fumadocs' theme manager to the design system instead of letting both fight over
 * `.dark` on `<html>`.
 *
 * This is the `appearance` contract the provider was built for — the docs are the first real
 * consumer to exercise it, which is the point of running them on App Router at all.
 */
export const KanzoProvider = ({ children }: { children: ReactNode }) => {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <KanzoThemeProvider appearance={{ resolvedTheme, setTheme }}>{children}</KanzoThemeProvider>
  );
};
