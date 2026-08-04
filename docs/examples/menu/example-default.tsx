import { CircleSlashIcon, CopyIcon, HandIcon } from "lucide-react";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </MenuTrigger>

      <MenuContent>
        <MenuItem value="claim">
          <HandIcon />
          Claim
          <MenuShortcut>⌘⏎</MenuShortcut>
        </MenuItem>

        <MenuItem value="repost">
          <CopyIcon />
          Post again
          <MenuShortcut>⌘D</MenuShortcut>
        </MenuItem>

        <MenuSeparator />

        <MenuItem value="abandon" variant="destructive">
          <CircleSlashIcon />
          Abandon
          <MenuShortcut>⌫</MenuShortcut>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
