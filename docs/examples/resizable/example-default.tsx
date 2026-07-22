import { Resizable, ResizablePanel, ResizableResizeTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    // The splitter fills its parent, so the parent is what decides how tall it is.
    <div className="h-64 w-full max-w-xl overflow-hidden rounded-lg border">
      <Resizable
        defaultSize={[35, 65]}
        panels={[{ id: "list", minSize: 20 }, { id: "detail", minSize: 30 }]}
      >
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="list"
        >
          List
        </ResizablePanel>
        <ResizableResizeTrigger id="list:detail" withHandle />
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="detail"
        >
          Detail
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
