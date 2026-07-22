"use client";

import { useState } from "react";
import { DatabaseIcon, ListIcon, TriangleAlertIcon } from "lucide-react";
import { StatusBar, StatusBarCenter, StatusBarEnd, StatusBarStart } from "@kanzo-tech/ui";

const PANELS = [
  { id: "outline", icon: <ListIcon />, label: "Outline" },
  { id: "issues", icon: <TriangleAlertIcon />, label: "Issues" },
  { id: "preview", icon: <DatabaseIcon />, label: "Preview" },
];

export default function Example() {
  const [active, setActive] = useState<string | null>("issues");

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background">
      {/* A canvas stand-in, so the bar reads as the bottom edge of something. */}
      <div className="h-32 bg-muted/30" />

      <StatusBar
        activePanel={active}
        onPanelToggle={(id) => setActive((current) => (current === id ? null : id))}
        panels={PANELS}
      >
        <StatusBarStart>aemet.fossil · 1,204 triples</StatusBarStart>
        <StatusBarCenter>Ln 42, Col 8</StatusBarCenter>
        <StatusBarEnd>UTF-8 · Fossil</StatusBarEnd>
      </StatusBar>
    </div>
  );
}
