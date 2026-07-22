import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Collapsible className="w-full max-w-sm" collapsedHeight="4rem">
      <CollapsibleContent className="rounded-md border p-3 text-muted-foreground text-sm">
        A `collapsedHeight` turns the collapse into a "read more" — the first 4rem stay
        visible instead of the region disappearing. Because the content must exist to be
        measured, this mode also switches off `lazyMount` and `unmountOnExit`.
        <br />
        <br />
        Everything below the fold is still in the DOM, still selectable, still found by
        the browser&apos;s in-page search.
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <Button className="mt-2" size="sm" variant="ghost">
          Read more
        </Button>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
