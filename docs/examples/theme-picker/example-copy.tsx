"use client";

import { ThemePicker } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full max-w-2xl">
      <ThemePicker
        copy={{
          mode: "Modo del tema",
          sync: "Sincronizar con el sistema",
          single: "Un solo tema",
          day: "Tema de día",
          night: "Tema de noche",
          theme: "Tema",
          active: "Activo",
        }}
      />
    </div>
  );
}
