"use client";

import { AppearanceToggle } from "@kanzo-tech/ui";

// `formatName` is a function prop, so this example is a client component — a server one cannot
// hand a function across the boundary.
// `labels` names the states; `formatName` writes the sentence around them. Without the second,
// this button would announce "Apariencia: Oscuro. Switch to claro". Hover it to read the name.
export default function Example() {
  return (
    <AppearanceToggle
      formatName={({ label, current, next }) =>
        `${label}: ${current}. Cambiar a ${next.toLowerCase()}`
      }
      label="Apariencia"
      labels={{ dark: "Oscuro", light: "Claro" }}
      variant="outline"
    />
  );
}
