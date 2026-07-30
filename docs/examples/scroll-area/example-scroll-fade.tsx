import { ScrollArea } from "@kanzo-tech/ui";
import { MEMBERS } from "@/example/people";

export default function Example() {
  return (
    <div className="h-64 w-64 rounded-lg border">
      <ScrollArea scrollFade>
        <div className="flex flex-col gap-2 p-3 text-sm">
          {MEMBERS.map((entry) => (
            <span key={entry.id}>{entry.name}</span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
