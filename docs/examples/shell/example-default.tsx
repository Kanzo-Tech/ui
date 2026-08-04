"use client";

import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useState } from "react";
import { NAV } from "@/example/nav";
import { openQuests, overdueQuests, quest } from "@/example/quests";
import { hall, HOME_HALL } from "@/example/world";
import {
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
  Toggle,
} from "@kanzo-tech/ui";

const home = hall(HOME_HALL);
const selected = quest("Q-1041");

// All six regions at once, holding a hall's board screen; the two header Toggles show/hide the
// side asides. Every visible style is applied at THIS call site — the regions place their
// children and draw the border, nothing more.
export default function Example() {
  const [navOpen, setNavOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  return (
    // `h-[26rem]` rather than ShellRoot's own `h-dvh`: this is a framed demo inside a docs
    // page, not a shell that owns the viewport. A real one keeps `h-dvh`.
    <ShellRoot className="h-[26rem] w-full">
      <ShellHeader className="h-11 flex-row items-center justify-between gap-2 bg-card px-3">
        <span className="font-medium text-sm">{home.name}</span>
        <div className="flex items-center gap-1">
          <Toggle
            aria-label="Toggle navigation"
            onPressedChange={setNavOpen}
            pressed={navOpen}
            size="sm"
          >
            <PanelLeftIcon />
          </Toggle>
          <Toggle
            aria-label="Toggle inspector"
            onPressedChange={setInspectorOpen}
            pressed={inspectorOpen}
            size="sm"
          >
            <PanelRightIcon />
          </Toggle>
        </div>
      </ShellHeader>

      <ShellBody>
        <Show when={navOpen}>
          <ShellAside
            aria-label="Navigation"
            className="gap-1.5 p-3"
            side="start"
            width={180}
          >
            {NAV.map((item) => (
              <span className="text-muted-foreground text-xs" key={item.title}>
                {item.title}
              </span>
            ))}
          </ShellAside>
        </Show>

        {/* The one <main> on the page. Nested containers use <section> — see Section. */}
        <ShellMain className="items-center justify-center bg-muted/24 p-4">
          <span className="font-medium text-sm">The board</span>
          <span className="mt-1 text-muted-foreground text-xs">
            {openQuests().length} open, {overdueQuests().length} overdue
          </span>
        </ShellMain>

        <Show when={inspectorOpen}>
          <ShellAside
            aria-label="Inspector"
            className="gap-1 p-3"
            side="end"
            width={180}
          >
            <span className="font-medium text-xs">{selected.id}</span>
            <span className="text-muted-foreground text-xs">
              {selected.title}
            </span>
          </ShellAside>
        </Show>
      </ShellBody>

      <ShellFooter className="h-7 flex-row items-center bg-card px-3">
        <span className="text-[11px] text-muted-foreground">{home.motto}</span>
      </ShellFooter>
    </ShellRoot>
  );
}
