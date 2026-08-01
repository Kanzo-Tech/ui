import { breaches } from "@/example/rules";
import { Resizable, ResizablePanel, ResizableResizeTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="h-64 w-full max-w-xl overflow-hidden rounded-lg border">
      <Resizable
        defaultSize={[60, 40]}
        orientation="vertical"
        panels={[{ id: "rules", minSize: 20 }, { id: "breaches", minSize: 20 }]}
      >
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="rules"
        >
          The party rules
        </ResizablePanel>
        <ResizableResizeTrigger id="rules:breaches" withHandle />
        <ResizablePanel
          className="flex items-center justify-center text-muted-foreground text-sm"
          id="breaches"
        >
          {breaches().length} breaches
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
