import { SwatchGroup } from "@kanzo-tech/ui";

const PALETTES = [
  { name: "Dracula", accents: ["#ff5555", "#ffb86c", "#f1fa8c", "#50fa7b", "#8be9fd", "#bd93f9"] },
  { name: "Nord", accents: ["#bf616a", "#d08770", "#ebcb8b", "#a3be8c", "#88c0d0", "#81a1c1"] },
  {
    name: "Catppuccin Mocha",
    accents: ["#f38ba8", "#fab387", "#f9e2af", "#a6e3a1", "#94e2d5", "#89b4fa"],
  },
];

export default function Example() {
  return (
    <ul className="flex w-64 flex-col gap-2 text-sm">
      {PALETTES.map((palette) => (
        <li className="flex items-center justify-between gap-3" key={palette.name}>
          {palette.name}
          <SwatchGroup colors={palette.accents} />
        </li>
      ))}
    </ul>
  );
}
