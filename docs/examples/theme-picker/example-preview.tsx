"use client";

import { themeIndex } from "@kanzo-tech/theme";
import { ThemePreview } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
      {themeIndex.map((theme) => (
        <figure className="flex flex-col gap-1" key={theme.value}>
          <ThemePreview theme={theme.value} />
          <figcaption className="font-mono text-muted-foreground text-xs">{theme.value}</figcaption>
        </figure>
      ))}
    </div>
  );
}
