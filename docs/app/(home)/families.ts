import { themeFamilies, themeIndex } from "@kanzo-tech/theme";

/** A family's name is what its two labels share: "Catppuccin Latte" and "Catppuccin Mocha". */
function familyName(light = "", dark = "") {
  const b = dark.split(" ");
  return light.split(" ").filter((word, i) => word === b[i]).join(" ") || light;
}

/** Shared by the server half (which reads each theme's file) and the client half (which paints it). */
export const FAMILIES = themeFamilies(themeIndex).map((f) => ({
  ...f,
  name: familyName(f.light?.label, f.dark?.label),
}));
