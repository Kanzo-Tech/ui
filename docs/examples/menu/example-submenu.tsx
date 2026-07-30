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
        <Button variant="outline">Board</Button>
      </MenuTrigger>

      <MenuContent className="w-48">
        <MenuItem value="post">Post a contract</MenuItem>
        <MenuItem value="overdue">Show overdue</MenuItem>

        <MenuSeparator />

        <MenuSub>
          <MenuSubTrigger>Export as</MenuSubTrigger>

          <MenuSubContent className="w-40">
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
            <MenuItem value="sheet">Printable sheet</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
