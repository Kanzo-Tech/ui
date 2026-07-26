import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuContextTrigger,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuContextTrigger asChild>
        <div className="flex h-32 w-72 items-center justify-center rounded-xl border-2 border-border border-dashed text-muted-foreground text-sm">
          Right-click here
        </div>
      </MenuContextTrigger>

      <MenuContent className="w-44">
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
