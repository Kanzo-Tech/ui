import {
  Button,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Commands</Button>
      </MenuTrigger>

      <MenuContent className="w-56">
        <MenuGroup heading="Board">
          <MenuItem value="post">Post a contract</MenuItem>
          <MenuItem value="claim">Claim a contract</MenuItem>
          <MenuItem value="overdue">Show overdue contracts</MenuItem>
        </MenuGroup>

        <MenuSeparator />

        <MenuGroup heading="Roster">
          <MenuItem value="roster">Find a member</MenuItem>
          <MenuItem value="available">Who is ready today</MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
