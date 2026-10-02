"use client";

import { ThemePicker } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full max-w-2xl">
      <ThemePicker
        copy={{
          appearance: "Apariencia",
          light: "Claro",
          dark: "Oscuro",
          day: "Tema claro",
          dayDescription: "Se usa con la apariencia clara.",
          night: "Tema oscuro",
          nightDescription: "Se usa con la apariencia oscura.",
          active: "Activo",
        }}
      />
    </div>
  );
}
