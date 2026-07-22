import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex h-32 w-72 items-center justify-center rounded-xl border-2 border-border border-dashed text-muted-foreground text-sm">
          Right-click here
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-44">
        <ContextMenuItem value="edit">
          <PencilIcon />
          Edit
          <ContextMenuShortcut>⌘E</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem value="duplicate">
          <CopyIcon />
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem value="delete" variant="destructive">
          <TrashIcon />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
