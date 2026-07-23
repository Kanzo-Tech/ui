import { Button, Card, CardContent, Ribbon } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6 p-2">
      <Ribbon label="Beta" variant="info">
        <Button className="w-full" variant="outline">
          Corner
        </Button>
      </Ribbon>

      <Ribbon label="New" placement="inline" variant="success">
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            Inline — the badge sits in the flow at the trailing edge and takes its own
            space, so it never covers the content it annotates.
          </CardContent>
        </Card>
      </Ribbon>
    </div>
  );
}
