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
        <div className="flex h-32 w-72 items-center justify-center rounded-xl border-2 border-border border-dashed px-4 text-center text-muted-foreground text-sm">
          Q-1041 · Something is eating the bell-ropes
        </div>
      </MenuContextTrigger>

      <MenuContent className="w-48">
        <MenuItem value="open">Open the contract</MenuItem>
        <MenuItem value="claim">Claim it</MenuItem>

        <MenuSeparator />

        <MenuSub>
          <MenuSubTrigger>Copy</MenuSubTrigger>

          <MenuSubContent className="w-40">
            <MenuItem value="id">Contract id</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
