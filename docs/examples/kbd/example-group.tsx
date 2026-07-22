import { Kbd, KbdGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2 text-muted-foreground text-sm">
      <span className="flex items-center gap-2">
        Command palette
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </span>
      <span className="flex items-center gap-2">
        Toggle sidebar
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </span>
    </div>
  );
}
