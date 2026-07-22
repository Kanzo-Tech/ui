import { Button, Card, CardContent, ComingSoon } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6 p-2">
      <ComingSoon label="Beta">
        <Button className="w-full" variant="outline">
          Corner
        </Button>
      </ComingSoon>

      <ComingSoon placement="inline">
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            Inline — the badge sits in the flow at the trailing edge and takes its own
            space, so it never covers the content it annotates.
          </CardContent>
        </Card>
      </ComingSoon>
    </div>
  );
}
