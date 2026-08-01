import { CircleSlashIcon, CopyIcon, HandIcon } from "lucide-react";
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
        <div className="flex h-32 w-72 items-center justify-center rounded-xl border-2 border-border border-dashed px-4 text-center text-muted-foreground text-sm">
          Q-1041 · Something is eating the bell-ropes
        </div>
      </MenuContextTrigger>

      <MenuContent className="w-44">
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
