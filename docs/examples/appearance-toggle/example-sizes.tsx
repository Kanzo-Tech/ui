import { AppearanceToggle } from "@kanzo-tech/ui";

// Three mounts, one preference: click any of them and all three change face.
export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <AppearanceToggle size="icon-sm" />
      <AppearanceToggle size="icon-md" />
      <AppearanceToggle size="icon-lg" variant="outline" />
    </div>
  );
}
