"use client";

import * as React from "react";
import { Badge, Button, ClientOnly, toast, useKanzoTheme } from "@kanzo-tech/ui";

/**
 * Says, once, that the theme this reader chose is no longer published — a toast in the host's own
 * `<Toaster />`, from the state the provider already holds. Copy it beside your toaster.
 *
 * The provider clears a retired choice and keeps its name in `retiredTheme` for the session, and the
 * theme cards say so in an alert. A tenant that withholds the theme draws no cards, so a toast is the
 * surface left. Keyed on the name, not a boolean: StrictMode, or a notice mounted behind a route
 * after the provider found the retirement, would otherwise say it twice.
 */
function ThemeNotice({ title, describe }: { title: string; describe: (theme: string) => string }) {
  const { retiredTheme } = useKanzoTheme();
  const said = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!retiredTheme || said.current === retiredTheme) return;
    said.current = retiredTheme;
    toast.create({ title, description: describe(retiredTheme), type: "info" });
  }, [retiredTheme, title, describe]);
  return null;
}

const describe = (theme: string) => `“${theme}” is no longer offered here. You are seeing the default.`;

function Readout() {
  const { retiredTheme } = useKanzoTheme();
  return (
    <div className="flex flex-col items-center gap-3">
      <ThemeNotice describe={describe} title="Brand updated" />
      <Badge variant="secondary">retiredTheme: {retiredTheme ?? "none"}</Badge>
      {/* What the notice says, without waiting for a tenant to withdraw a theme. */}
      <Button
        onClick={() => toast.create({ title: "Brand updated", description: describe("dracula"), type: "info" })}
        size="sm"
        variant="outline"
      >
        Show the notice
      </Button>
    </div>
  );
}

export default function Example() {
  return (
    <ClientOnly>
      <Readout />
    </ClientOnly>
  );
}
