import {
  Menu,
  MenuContent,
  MenuContextTrigger,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuContextTrigger asChild>
        <div className="flex h-32 w-72 items-center justify-center rounded-xl border-2 border-border border-dashed text-muted-foreground text-sm">
          Right-click here
        </div>
      </MenuContextTrigger>

      <MenuContent className="w-48">
        <MenuItem value="open">Open</MenuItem>
        <MenuItem value="rename">Rename</MenuItem>

        <MenuSeparator />

        <MenuSub>
          <MenuSubTrigger>Export as</MenuSubTrigger>

          <MenuSubContent className="w-40">
            <MenuItem value="turtle">Turtle</MenuItem>
            <MenuItem value="jsonld">JSON-LD</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
