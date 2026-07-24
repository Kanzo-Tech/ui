"use client";

import type { Appearance } from "@kanzo-tech/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button, type ButtonProps } from "../simples/button.js";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../simples/menu.js";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";

export interface AppearanceToggleLabels {
  light: string;
  dark: string;
  system: string;
}

export interface AppearanceToggleProps {
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  /** Override the item labels (i18n). */
  labels?: Partial<AppearanceToggleLabels>;
}

const DEFAULT_LABELS: AppearanceToggleLabels = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * A light/dark/system appearance switcher: an icon button whose sun/moon crossfade is keyed off
 * `.dark` in CSS (no JS), opening a 3-state radio menu. Wired to {@link useKanzoTheme}.
 */
export const AppearanceToggle = ({
  className,
  size = "icon-md",
  variant = "ghost",
  labels,
}: AppearanceToggleProps = {}) => {
  const { appearance, setAppearance } = useKanzoTheme();
  const l = { ...DEFAULT_LABELS, ...labels };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          aria-label="Appearance"
          className={className}
        >
          <SunIcon className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuRadioGroup
          value={appearance}
          onValueChange={(d) => setAppearance(d.value as Appearance)}
        >
          <MenuRadioItem value="light">
            <SunIcon /> {l.light}
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <MoonIcon /> {l.dark}
          </MenuRadioItem>
          <MenuRadioItem value="system">
            <MonitorIcon /> {l.system}
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
};
