import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Dataset</Button>
      </MenuTrigger>

      <MenuContent className="w-48">
        <MenuItem value="open">Open</MenuItem>
        <MenuItem value="rename">Rename</MenuItem>

        <MenuSeparator />

        <MenuSub>
          <MenuSubTrigger>Export as</MenuSubTrigger>

          <MenuSubContent className="w-40">
            <MenuItem value="turtle">Turtle</MenuItem>
            <MenuItem value="jsonld">JSON-LD</MenuItem>
            <MenuItem value="csv">CSV</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
