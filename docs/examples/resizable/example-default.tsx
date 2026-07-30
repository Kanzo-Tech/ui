import { quest } from "@/example/quests";
import { Resizable, ResizablePanel, ResizableResizeTrigger } from "@kanzo-tech/ui";

const selected = quest("Q-1041");

export default function Example() {
  return (
    // The splitter fills its parent, so the parent is what decides how tall it is.
    <div className="h-64 w-full max-w-xl overflow-hidden rounded-lg border">
      <Resizable
        defaultSize={[35, 65]}
        panels={[{ id: "board", minSize: 20 }, { id: "contract", minSize: 30 }]}
      >
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="board"
        >
          The board
        </ResizablePanel>
        <ResizableResizeTrigger id="board:contract" withHandle />
        <ResizablePanel
          className="flex flex-col items-center justify-center gap-1 px-4 text-center text-sm"
          id="contract"
        >
          <span className="font-medium">{selected.id}</span>
          <span className="text-muted-foreground">{selected.title}</span>
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
