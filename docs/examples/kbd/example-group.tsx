import { Kbd, KbdGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2 text-muted-foreground text-sm">
      <span className="flex items-center gap-2">
        Search the board
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </span>
      <span className="flex items-center gap-2">
        Post a contract
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>N</Kbd>
        </KbdGroup>
      </span>
    </div>
  );
}
