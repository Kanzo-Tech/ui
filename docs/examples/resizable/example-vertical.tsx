import { Resizable, ResizablePanel, ResizableResizeTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="h-64 w-full max-w-xl overflow-hidden rounded-lg border">
      <Resizable
        defaultSize={[60, 40]}
        orientation="vertical"
        panels={[{ id: "editor", minSize: 20 }, { id: "output", minSize: 20 }]}
      >
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="editor"
        >
          Editor
        </ResizablePanel>
        <ResizableResizeTrigger id="editor:output" withHandle />
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="output"
        >
          Output
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
