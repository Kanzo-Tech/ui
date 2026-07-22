import { ScrollArea } from "@kanzo-tech/ui";

const tags = Array.from({ length: 30 }, (_, i) => `tag-${i + 1}`);

export default function Example() {
  return (
    // ScrollArea is `size-full` — it scrolls only inside a parent that constrains it.
    <div className="h-64 w-64 rounded-lg border">
      <ScrollArea>
        <div className="flex flex-col gap-2 p-3 text-sm">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
