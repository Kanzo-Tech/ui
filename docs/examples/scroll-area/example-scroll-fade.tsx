import { ScrollArea } from "@kanzo-tech/ui";

const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`);

export default function Example() {
  return (
    <div className="h-64 w-64 rounded-lg border">
      <ScrollArea scrollFade>
        <div className="flex flex-col gap-2 p-3 text-sm">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
