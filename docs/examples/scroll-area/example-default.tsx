import { ScrollArea } from "@kanzo-tech/ui";
import { TAGS } from "@/example/world";

export default function Example() {
  return (
    // ScrollArea is `size-full` — it scrolls only inside a parent that constrains it.
    <div className="h-64 w-64 rounded-lg border">
      <ScrollArea>
        <div className="flex flex-col gap-2 p-3 text-sm">
          {TAGS.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
