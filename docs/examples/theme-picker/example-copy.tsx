"use client";

import { ThemePicker } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full max-w-2xl">
      <ThemePicker
        copy={{
          mode: "Modo del tema",
          sync: "Sincronizar con el sistema",
          syncDescription: "Sigue el modo claro u oscuro de tu sistema.",
          single: "Un solo tema",
          singleDescription: "Un tema, sea cual sea el modo de tu sistema.",
          day: "Tema claro",
          dayDescription: "Activo cuando tu sistema está en modo claro.",
          night: "Tema oscuro",
          nightDescription: "Activo cuando tu sistema está en modo oscuro.",
          theme: "Tema",
          active: "Activo",
        }}
      />
    </div>
  );
}
