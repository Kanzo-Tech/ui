"use client";

import { PreferencesSections } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <PreferencesSections
        copy={{
          theme: "Tema",
          appearance: "Apariencia",
          day: "Tema claro",
          dayDescription: "Se usa con la apariencia clara.",
          night: "Tema oscuro",
          nightDescription: "Se usa con la apariencia oscura.",
          active: "Activo",
        }}
        namespace="theme"
        only={["appearance"]}
      />
    </div>
  );
}
