import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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

      <ContextMenuContent className="w-48">
        <ContextMenuItem value="open">Open</ContextMenuItem>
        <ContextMenuItem value="rename">Rename</ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Export as</ContextMenuSubTrigger>

          <ContextMenuSubContent className="w-40">
            <ContextMenuItem value="turtle">Turtle</ContextMenuItem>
            <ContextMenuItem value="jsonld">JSON-LD</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
