import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
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
        <MenuItem value="edit">
          <PencilIcon />
          Edit
          <MenuShortcut>⌘E</MenuShortcut>
        </MenuItem>

        <MenuItem value="duplicate">
          <CopyIcon />
          Duplicate
          <MenuShortcut>⌘D</MenuShortcut>
        </MenuItem>

        <MenuSeparator />

        <MenuItem value="delete" variant="destructive">
          <TrashIcon />
          Delete
          <MenuShortcut>⌫</MenuShortcut>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
